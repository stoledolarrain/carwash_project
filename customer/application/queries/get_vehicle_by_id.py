"""Query: obtiene un vehículo por su UUID (solo lectura)."""

from __future__ import annotations

from uuid import UUID

from application.dto.vehicle_dto import VehicleDto
from application.errors import VehicleNotFoundError
from application.ports.vehicle_repository import VehicleRepository
from application.validation import parse_uuid


class GetVehicleById:
    def __init__(self, *, vehicle_repository: VehicleRepository) -> None:
        self._vehicle_repository = vehicle_repository

    def execute(self, *, vehicle_id: UUID | str) -> VehicleDto:
        resolved_id = parse_uuid(vehicle_id, "vehicle_id")
        vehicle = self._vehicle_repository.find_by_id(resolved_id)
        if vehicle is None:
            raise VehicleNotFoundError(resolved_id)
        return VehicleDto.from_entity(vehicle)
