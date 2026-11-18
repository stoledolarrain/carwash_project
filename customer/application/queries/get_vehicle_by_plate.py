"""Query: obtiene un vehículo por su placa normalizada (solo lectura)."""

from __future__ import annotations

from application.dto.vehicle_dto import VehicleDto
from application.errors import VehicleNotFoundError
from application.ports.vehicle_repository import VehicleRepository
from domain.value_objects.plate import Plate


class GetVehicleByPlate:
    def __init__(self, *, vehicle_repository: VehicleRepository) -> None:
        self._vehicle_repository = vehicle_repository

    def execute(self, *, plate: str | Plate) -> VehicleDto:
        normalized_plate = plate if isinstance(plate, Plate) else Plate(plate)
        vehicle = self._vehicle_repository.find_by_plate(normalized_plate)
        if vehicle is None:
            raise VehicleNotFoundError(normalized_plate.value)
        return VehicleDto.from_entity(vehicle)
