"""DTO inmutable para representar un vehículo fuera de la capa Domain."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from domain.entities.vehicle import Vehicle


@dataclass(frozen=True)
class VehicleDto:
    id: UUID
    plate: str
    brand: str
    model: str
    color: str
    customer_id: UUID | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_entity(cls, vehicle: Vehicle) -> VehicleDto:
        return cls(
            id=vehicle.id,
            plate=vehicle.plate.value,
            brand=vehicle.brand,
            model=vehicle.model,
            color=vehicle.color,
            customer_id=vehicle.customer_id,
            created_at=vehicle.created_at,
            updated_at=vehicle.updated_at,
        )
