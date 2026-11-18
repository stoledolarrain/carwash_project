"""DTOs inmutables para la proyección de historial de lavados y eventos entrantes."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID


@dataclass(frozen=True)
class WashHistoryItemDto:
    order_id: UUID
    plate: str
    customer_id: UUID | None
    services: tuple[str, ...]
    total_price: Decimal
    responsible_id: str | None
    status: str
    created_at: datetime
    delivered_at: datetime | None
    last_event_at: datetime


@dataclass(frozen=True)
class IncomingWashOrderEvent:
    """Representación neutral de un evento de Wash Order ya deserializado."""

    event_id: UUID
    evento: str
    aggregate_id: UUID
    topic: str
    occurred_at: datetime
    order_id: UUID
    plate: str
    customer_id: UUID | None
    services: tuple[str, ...]
    total_price: Decimal
    responsible_id: str | None
    status: str
    created_at: datetime
    delivered_at: datetime | None
