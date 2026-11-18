"""Repositorio PostgreSQL de Transactional Outbox con SELECT ... FOR UPDATE SKIP LOCKED."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Callable, Sequence
from uuid import UUID

from django.db import transaction
from django.db.models import Exists, OuterRef

from domain.events import (
    CustomerActivated,
    CustomerDeactivated,
    CustomerRegistered,
    CustomerUpdated,
    DomainEvent,
    VehicleRegistered,
    VehicleUpdated,
)
from infrastructure.models import OutboxEventModel

SERVICE_ORIGIN = "customer-service"

TOPIC_BY_EVENT: dict[str, str] = {
    "CustomerRegistered": "customer.customer.registered",
    "CustomerUpdated": "customer.customer.updated",
    "CustomerActivated": "customer.customer.activated",
    "CustomerDeactivated": "customer.customer.deactivated",
    "VehicleRegistered": "customer.vehicle.registered",
    "VehicleUpdated": "customer.vehicle.updated",
}

_PG_URL_RE = re.compile(r"postgres(?:ql)?://[^\s'\"]+", re.IGNORECASE)
_SECRET_RE = re.compile(
    r"(password|secret|token|authorization)\s*[:=]\s*[^\s,;]+",
    re.IGNORECASE,
)


def resolve_topic(event_name: str) -> str:
    return TOPIC_BY_EVENT.get(event_name, "customer.events")


def sanitize_error_message(error: object) -> str:
    raw = str(error or "Error desconocido al publicar evento.")
    redacted = _PG_URL_RE.sub("postgresql://[REDACTED]", raw)
    redacted = _SECRET_RE.sub(r"\1=[REDACTED]", redacted)
    return redacted[:1000]


def _format_utc(dt: datetime) -> str:
    utc_dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
    return utc_dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _serialize_event_data(event: DomainEvent) -> dict[str, Any]:
    if isinstance(event, CustomerRegistered):
        return {
            "id": str(event.aggregate_id),
            "name": event.name,
            "isActive": event.is_active,
        }
    if isinstance(event, CustomerUpdated):
        return {
            "id": str(event.aggregate_id),
            "name": event.name,
            "isActive": event.is_active,
            "changedFields": list(event.changed_fields),
        }
    if isinstance(event, (CustomerActivated, CustomerDeactivated)):
        return {
            "id": str(event.aggregate_id),
            "name": event.name,
            "isActive": event.is_active,
        }
    if isinstance(event, VehicleRegistered):
        return {
            "id": str(event.aggregate_id),
            "plate": event.plate,
            "brand": event.brand,
            "model": event.model,
            "color": event.color,
            "customerId": str(event.customer_id) if event.customer_id is not None else None,
        }
    if isinstance(event, VehicleUpdated):
        return {
            "id": str(event.aggregate_id),
            "plate": event.plate,
            "brand": event.brand,
            "model": event.model,
            "color": event.color,
            "customerId": str(event.customer_id) if event.customer_id is not None else None,
            "changedFields": list(event.changed_fields),
        }
    return {"id": str(event.aggregate_id)}


def build_envelope(event: DomainEvent) -> dict[str, Any]:
    """Construye el sobre común acordado con Catalog, Identity y Wash Order."""
    return {
        "eventId": str(event.event_id),
        "evento": event.event_name,
        "eventVersion": 1,
        "fechaEmision": _format_utc(event.occurred_at),
        "aggregateId": str(event.aggregate_id),
        "origen": SERVICE_ORIGIN,
        "datos": _serialize_event_data(event),
    }


class DjangoOutboxRepository:
    """Gestiona la persistencia y despacho concurrente seguro de outbox_events."""

    def save_all(self, events: Sequence[DomainEvent]) -> list[OutboxEventModel]:
        if not events:
            return []

        records = [
            OutboxEventModel(
                id=event.event_id,
                event_name=event.event_name,
                aggregate_id=event.aggregate_id,
                topic=resolve_topic(event.event_name),
                payload=build_envelope(event),
                created_at=event.occurred_at,
                published_at=None,
                attempts=0,
                last_error=None,
            )
            for event in events
        ]
        OutboxEventModel.objects.bulk_create(records)
        return records

    def find_pending(self, *, limit: int = 50) -> list[OutboxEventModel]:
        return list(
            OutboxEventModel.objects.filter(published_at__isnull=True)
            .order_by("created_at", "id")[:limit]
        )

    def process_pending_batch(
        self,
        *,
        publish_one: Callable[[OutboxEventModel], None],
        limit: int = 50,
    ) -> dict[str, int]:
        """Reclama y publica eventos pendientes usando SELECT ... FOR UPDATE SKIP LOCKED.

        - Preserva el orden por `aggregate_id` (no adelanta un evento posterior si hay uno previo pendiente).
        - Evita reintentar el mismo evento fallido dentro del mismo ciclo (`attempted_ids`).
        - Usa transacciones cortas por evento para no bloquear otros workers.
        """
        processed = 0
        published = 0
        failed = 0
        attempted_ids: list[UUID] = []

        for _ in range(limit):
            outcome, event_id = self._claim_and_process_next(publish_one, attempted_ids)
            if outcome == "empty":
                break
            if event_id is not None:
                attempted_ids.append(event_id)
            processed += 1
            if outcome == "published":
                published += 1
            else:
                failed += 1

        return {"processed": processed, "published": published, "failed": failed}

    def _claim_and_process_next(
        self,
        publish_one: Callable[[OutboxEventModel], None],
        excluded_ids: list[UUID],
    ) -> tuple[str, UUID | None]:
        with transaction.atomic():
            earlier_pending = OutboxEventModel.objects.filter(
                aggregate_id=OuterRef("aggregate_id"),
                published_at__isnull=True,
                created_at__lt=OuterRef("created_at"),
            )
            queryset = (
                OutboxEventModel.objects.select_for_update(skip_locked=True)
                .filter(published_at__isnull=True)
                .exclude(id__in=excluded_ids)
                .annotate(has_earlier_pending=Exists(earlier_pending))
                .filter(has_earlier_pending=False)
                .order_by("created_at", "id")
            )
            record = queryset.first()
            if record is None:
                return "empty", None

            try:
                publish_one(record)
            except Exception as exc:
                record.attempts += 1
                record.last_error = sanitize_error_message(exc)
                record.save(update_fields=["attempts", "last_error"])
                return "failed", record.id

            record.published_at = datetime.now(timezone.utc)
            record.attempts += 1
            record.last_error = None
            record.save(update_fields=["published_at", "attempts", "last_error"])
            return "published", record.id
