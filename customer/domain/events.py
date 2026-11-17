"""Eventos de dominio inmutables de Customer / Vehicle Service.

No incluyen infraestructura (Kafka, Outbox ni Django) ni datos personales innecesarios
como teléfono o correo electrónico.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@dataclass(frozen=True, kw_only=True)
class DomainEvent:
    """Evento base de dominio con identificador único, agregado y marca temporal UTC."""

    aggregate_id: UUID
    occurred_at: datetime
    event_id: UUID = field(default_factory=uuid4)

    def __post_init__(self) -> None:
        object.__setattr__(self, "occurred_at", _ensure_utc(self.occurred_at))

    @property
    def event_name(self) -> str:
        return type(self).__name__


@dataclass(frozen=True, kw_only=True)
class CustomerRegistered(DomainEvent):
    """Emitido al registrar un nuevo cliente (sin teléfono ni correo)."""

    name: str
    is_active: bool = True


@dataclass(frozen=True, kw_only=True)
class CustomerUpdated(DomainEvent):
    """Emitido cuando se modifican datos del cliente (indica qué campos cambiaron sin exponer PII)."""

    name: str
    is_active: bool
    changed_fields: tuple[str, ...]


@dataclass(frozen=True, kw_only=True)
class CustomerActivated(DomainEvent):
    """Emitido cuando un cliente inactivo pasa a estado activo."""

    name: str
    is_active: bool = True


@dataclass(frozen=True, kw_only=True)
class CustomerDeactivated(DomainEvent):
    """Emitido cuando un cliente activo pasa a estado inactivo."""

    name: str
    is_active: bool = False


@dataclass(frozen=True, kw_only=True)
class VehicleRegistered(DomainEvent):
    """Emitido al registrar un nuevo vehículo por placa."""

    plate: str
    brand: str
    model: str
    color: str
    customer_id: UUID | None = None


@dataclass(frozen=True, kw_only=True)
class VehicleUpdated(DomainEvent):
    """Emitido al actualizar datos del vehículo o cambiar su cliente asociado."""

    plate: str
    brand: str
    model: str
    color: str
    customer_id: UUID | None
    changed_fields: tuple[str, ...]
