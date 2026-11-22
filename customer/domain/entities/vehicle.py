"""Entidad raíz de agregado Vehicle."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from domain.errors import InvalidVehicleDataError
from domain.events import DomainEvent, VehicleRegistered, VehicleUpdated
from domain.value_objects.plate import Plate

MAX_BRAND_LENGTH = 50
MAX_MODEL_LENGTH = 50
MAX_COLOR_LENGTH = 30
_UNSET: Any = object()


def _utc_now(now: datetime | None = None) -> datetime:
    current = datetime.now(timezone.utc) if now is None else now
    if not isinstance(current, datetime):
        raise InvalidVehicleDataError("La fecha debe ser una instancia de datetime.")
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _normalize_uuid(value: UUID | str, field_name: str) -> UUID:
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        try:
            return UUID(value)
        except ValueError as exc:
            raise InvalidVehicleDataError(f"El campo '{field_name}' debe ser un UUID válido.") from exc
    raise InvalidVehicleDataError(f"El campo '{field_name}' debe ser un UUID válido.")


def _normalize_optional_uuid(value: UUID | str | None, field_name: str) -> UUID | None:
    if value is None:
        return None
    return _normalize_uuid(value, field_name)


def _normalize_required_text(value: object, field_name: str, max_length: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise InvalidVehicleDataError(f"El campo '{field_name}' del vehículo es obligatorio.")
    normalized = value.strip()
    if len(normalized) > max_length:
        raise InvalidVehicleDataError(
            f"El campo '{field_name}' no puede superar {max_length} caracteres."
        )
    return normalized


def _normalize_color(color: object) -> str:
    if color is None:
        return ""
    if not isinstance(color, str):
        raise InvalidVehicleDataError("El color del vehículo debe ser un texto.")
    normalized = color.strip()
    if len(normalized) > MAX_COLOR_LENGTH:
        raise InvalidVehicleDataError(
            f"El color del vehículo no puede superar {MAX_COLOR_LENGTH} caracteres."
        )
    return normalized


def _normalize_plate(plate: Plate | str) -> Plate:
    return plate if isinstance(plate, Plate) else Plate(plate)


class Vehicle:
    """Agregado raíz de vehículo identificado por placa inmutable y cliente opcional."""

    def __init__(
        self,
        *,
        id: UUID,
        plate: Plate,
        brand: str,
        model: str,
        color: str,
        customer_id: UUID | None,
        created_at: datetime,
        updated_at: datetime,
    ) -> None:
        self._id = id
        self._plate = plate
        self._brand = brand
        self._model = model
        self._color = color
        self._customer_id = customer_id
        self._created_at = created_at
        self._updated_at = updated_at
        self._events: list[DomainEvent] = []

    @classmethod
    def create(
        cls,
        *,
        plate: Plate | str,
        brand: str,
        model: str,
        color: str | None = None,
        customer_id: UUID | str | None = None,
        vehicle_id: UUID | str | None = None,
        now: datetime | None = None,
    ) -> Vehicle:
        """Factory Method: registra un vehículo nuevo y emite VehicleRegistered."""
        resolved_id = uuid4() if vehicle_id is None else _normalize_uuid(vehicle_id, "id")
        timestamp = _utc_now(now)

        vehicle = cls(
            id=resolved_id,
            plate=_normalize_plate(plate),
            brand=_normalize_required_text(brand, "brand", MAX_BRAND_LENGTH),
            model=_normalize_required_text(model, "model", MAX_MODEL_LENGTH),
            color=_normalize_color(color),
            customer_id=_normalize_optional_uuid(customer_id, "customer_id"),
            created_at=timestamp,
            updated_at=timestamp,
        )
        vehicle._events.append(
            VehicleRegistered(
                aggregate_id=vehicle._id,
                occurred_at=timestamp,
                plate=vehicle._plate.value,
                brand=vehicle._brand,
                model=vehicle._model,
                color=vehicle._color,
                customer_id=vehicle._customer_id,
            )
        )
        return vehicle

    @classmethod
    def restore(
        cls,
        *,
        id: UUID | str,
        plate: Plate | str,
        brand: str,
        model: str,
        color: str | None,
        customer_id: UUID | str | None,
        created_at: datetime,
        updated_at: datetime,
    ) -> Vehicle:
        """Factory Method: reconstruye un vehículo desde persistencia sin emitir eventos."""
        return cls(
            id=_normalize_uuid(id, "id"),
            plate=_normalize_plate(plate),
            brand=_normalize_required_text(brand, "brand", MAX_BRAND_LENGTH),
            model=_normalize_required_text(model, "model", MAX_MODEL_LENGTH),
            color=_normalize_color(color),
            customer_id=_normalize_optional_uuid(customer_id, "customer_id"),
            created_at=_utc_now(created_at),
            updated_at=_utc_now(updated_at),
        )

    @property
    def id(self) -> UUID:
        return self._id

    @property
    def plate(self) -> Plate:
        """Placa inmutable tras la creación del vehículo."""
        return self._plate

    @property
    def brand(self) -> str:
        return self._brand

    @property
    def model(self) -> str:
        return self._model

    @property
    def color(self) -> str:
        return self._color

    @property
    def customer_id(self) -> UUID | None:
        return self._customer_id

    @property
    def created_at(self) -> datetime:
        return self._created_at

    @property
    def updated_at(self) -> datetime:
        return self._updated_at

    def update(
        self,
        *,
        brand: Any = _UNSET,
        model: Any = _UNSET,
        color: Any = _UNSET,
        now: datetime | None = None,
    ) -> Vehicle:
        """Actualiza marca, modelo y/o color. Si no hay cambios reales no emite eventos."""
        changed_fields: list[str] = []
        new_brand = self._brand
        new_model = self._model
        new_color = self._color

        if brand is not _UNSET:
            new_brand = _normalize_required_text(brand, "brand", MAX_BRAND_LENGTH)
            if new_brand != self._brand:
                changed_fields.append("brand")

        if model is not _UNSET:
            new_model = _normalize_required_text(model, "model", MAX_MODEL_LENGTH)
            if new_model != self._model:
                changed_fields.append("model")

        if color is not _UNSET:
            new_color = _normalize_color(color)
            if new_color != self._color:
                changed_fields.append("color")

        if not changed_fields:
            return self

        timestamp = _utc_now(now)
        self._brand = new_brand
        self._model = new_model
        self._color = new_color
        self._updated_at = timestamp
        self._events.append(
            VehicleUpdated(
                aggregate_id=self._id,
                occurred_at=timestamp,
                plate=self._plate.value,
                brand=self._brand,
                model=self._model,
                color=self._color,
                customer_id=self._customer_id,
                changed_fields=tuple(changed_fields),
            )
        )
        return self

    def associate_customer(
        self,
        customer_id: UUID | str | None,
        now: datetime | None = None,
    ) -> Vehicle:
        """Asocia, reasigna o desasocia (con None) un cliente. No consulta existencia ni estado."""
        resolved_customer_id = _normalize_optional_uuid(customer_id, "customer_id")
        if resolved_customer_id == self._customer_id:
            return self

        timestamp = _utc_now(now)
        self._customer_id = resolved_customer_id
        self._updated_at = timestamp
        self._events.append(
            VehicleUpdated(
                aggregate_id=self._id,
                occurred_at=timestamp,
                plate=self._plate.value,
                brand=self._brand,
                model=self._model,
                color=self._color,
                customer_id=self._customer_id,
                changed_fields=("customer_id",),
            )
        )
        return self

    def disassociate_customer(self, now: datetime | None = None) -> Vehicle:
        """Desasocia el cliente actual dejando customer_id en None."""
        return self.associate_customer(None, now=now)

    def pull_domain_events(self) -> tuple[DomainEvent, ...]:
        """Devuelve los eventos pendientes en orden y limpia la cola interna."""
        pending = tuple(self._events)
        self._events.clear()
        return pending
