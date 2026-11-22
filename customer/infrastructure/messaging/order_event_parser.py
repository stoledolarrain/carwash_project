"""Deserializador y validador del contrato real de eventos de Wash Order Service."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from application.commands.apply_wash_order_event import (
    ORDER_STATUS_RANK,
    SUPPORTED_ORDER_EVENTS,
)
from application.dto.history_dto import IncomingWashOrderEvent
from domain.errors import InvalidPlateError
from domain.value_objects.plate import Plate

EXPECTED_ORDER_ORIGIN = "wash-order-service"


class InvalidOrderEventMessageError(Exception):
    """El mensaje recibido de Kafka no cumple el formato JSON o el contrato esperado."""


@dataclass(frozen=True)
class ParsedOrderEvent:
    status: str  # "valid" | "unknown_event"
    event: IncomingWashOrderEvent | None = None
    evento: str = ""


def _parse_uuid(value: Any, field_name: str) -> UUID:
    if not isinstance(value, str) or not value.strip():
        raise InvalidOrderEventMessageError(f"El campo '{field_name}' debe ser un UUID válido.")
    try:
        return UUID(value.strip())
    except ValueError as exc:
        raise InvalidOrderEventMessageError(
            f"El campo '{field_name}' no es un UUID válido."
        ) from exc


def _parse_iso_datetime(value: Any, field_name: str) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise InvalidOrderEventMessageError(f"El campo '{field_name}' debe ser una fecha ISO-8601.")
    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise InvalidOrderEventMessageError(
            f"El campo '{field_name}' no tiene formato ISO-8601 válido."
        ) from exc
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _parse_decimal(value: Any, field_name: str) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
        raise InvalidOrderEventMessageError(f"El campo '{field_name}' debe ser numérico.")
    try:
        amount = Decimal(str(value))
    except InvalidOperation as exc:
        raise InvalidOrderEventMessageError(f"El campo '{field_name}' no es un número válido.") from exc
    if not amount.is_finite() or amount < 0:
        raise InvalidOrderEventMessageError(f"El campo '{field_name}' debe ser mayor o igual a cero.")
    return amount.quantize(Decimal("0.01"))


def parse_order_event_message(
    raw_value: bytes | str | dict[str, Any],
    *,
    topic: str,
) -> ParsedOrderEvent:
    """Valida el sobre y el payload exacto publicado por Wash Order Service en Kafka."""
    if isinstance(raw_value, bytes):
        try:
            decoded = raw_value.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise InvalidOrderEventMessageError("El mensaje Kafka no es UTF-8 válido.") from exc
        raw_value = decoded

    if isinstance(raw_value, str):
        try:
            envelope = json.loads(raw_value)
        except json.JSONDecodeError as exc:
            raise InvalidOrderEventMessageError("El mensaje Kafka no es un JSON válido.") from exc
    elif isinstance(raw_value, dict):
        envelope = raw_value
    else:
        raise InvalidOrderEventMessageError("El mensaje Kafka debe ser un objeto JSON.")

    if not isinstance(envelope, dict):
        raise InvalidOrderEventMessageError("El sobre del evento debe ser un objeto JSON.")

    evento = envelope.get("evento")
    if not isinstance(evento, str) or not evento.strip():
        raise InvalidOrderEventMessageError("Falta el campo obligatorio 'evento' en el sobre.")
    evento = evento.strip()

    if evento not in SUPPORTED_ORDER_EVENTS:
        return ParsedOrderEvent(status="unknown_event", evento=evento)

    origen = envelope.get("origen")
    if origen is not None and (not isinstance(origen, str) or origen.strip() != EXPECTED_ORDER_ORIGIN):
        raise InvalidOrderEventMessageError(
            f"Origen de evento inesperado: '{origen}'. Se esperaba '{EXPECTED_ORDER_ORIGIN}'."
        )

    event_id = _parse_uuid(envelope.get("eventId"), "eventId")
    aggregate_id = _parse_uuid(envelope.get("aggregateId"), "aggregateId")
    occurred_at = _parse_iso_datetime(envelope.get("fechaEmision"), "fechaEmision")

    datos = envelope.get("datos")
    if not isinstance(datos, dict):
        raise InvalidOrderEventMessageError("El campo 'datos' debe ser un objeto JSON.")

    order_id = _parse_uuid(datos.get("id"), "datos.id")
    if order_id != aggregate_id:
        raise InvalidOrderEventMessageError(
            "El campo 'datos.id' debe coincidir con 'aggregateId'."
        )

    try:
        plate = Plate(datos.get("placaVehiculo")).value  # type: ignore[arg-type]
    except InvalidPlateError as exc:
        raise InvalidOrderEventMessageError(str(exc)) from exc

    raw_customer_id = datos.get("clienteId")
    customer_id = None if raw_customer_id is None else _parse_uuid(raw_customer_id, "datos.clienteId")

    raw_services = datos.get("servicios")
    if not isinstance(raw_services, list) or len(raw_services) == 0:
        raise InvalidOrderEventMessageError("El campo 'datos.servicios' debe ser una lista no vacía.")
    if not all(isinstance(s, str) and s.strip() for s in raw_services):
        raise InvalidOrderEventMessageError("Cada servicio en 'datos.servicios' debe ser texto no vacío.")
    services = tuple(s.strip() for s in raw_services)

    total_price = _parse_decimal(datos.get("precioTotal", 0), "datos.precioTotal")

    raw_responsible = datos.get("responsableId")
    if raw_responsible is not None and not isinstance(raw_responsible, str):
        raise InvalidOrderEventMessageError("El campo 'datos.responsableId' debe ser texto o null.")
    responsible_id = raw_responsible.strip() if isinstance(raw_responsible, str) and raw_responsible.strip() else None

    estado = datos.get("estado")
    if not isinstance(estado, str) or estado.strip() not in ORDER_STATUS_RANK:
        raise InvalidOrderEventMessageError(f"Estado de orden inválido en 'datos.estado': {estado!r}.")
    estado = estado.strip()

    created_at = _parse_iso_datetime(datos.get("fechaCreacion"), "datos.fechaCreacion")

    raw_delivered = datos.get("fechaEntrega")
    delivered_at = (
        None if raw_delivered is None else _parse_iso_datetime(raw_delivered, "datos.fechaEntrega")
    )

    return ParsedOrderEvent(
        status="valid",
        evento=evento,
        event=IncomingWashOrderEvent(
            event_id=event_id,
            evento=evento,
            aggregate_id=aggregate_id,
            topic=topic,
            occurred_at=occurred_at,
            order_id=order_id,
            plate=plate,
            customer_id=customer_id,
            services=services,
            total_price=total_price,
            responsible_id=responsible_id,
            status=estado,
            created_at=created_at,
            delivered_at=delivered_at,
        ),
    )
