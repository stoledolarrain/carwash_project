"""Command: actualiza marca, modelo y/o color de un vehículo (la placa es inmutable)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from application.dto.vehicle_dto import VehicleDto
from application.errors import InvalidRequestError, VehicleNotFoundError
from application.ports.unit_of_work import UnitOfWork
from application.ports.vehicle_repository import VehicleRepository
from application.validation import UNSET, parse_uuid


class UpdateVehicle:
    def __init__(
        self,
        *,
        vehicle_repository: VehicleRepository,
        uow: UnitOfWork,
    ) -> None:
        self._vehicle_repository = vehicle_repository
        self._uow = uow

    def execute(
        self,
        *,
        vehicle_id: UUID | str,
        brand: Any = UNSET,
        model: Any = UNSET,
        color: Any = UNSET,
    ) -> VehicleDto:
        if brand is UNSET and model is UNSET and color is UNSET:
            raise InvalidRequestError(
                "Debe especificar al menos uno de: 'brand', 'model' o 'color'."
            )

        resolved_id = parse_uuid(vehicle_id, "vehicle_id")

        with self._uow.atomic():
            vehicle = self._vehicle_repository.find_by_id(resolved_id)
            if vehicle is None:
                raise VehicleNotFoundError(resolved_id)

            before = (vehicle.brand, vehicle.model, vehicle.color)
            update_kwargs: dict[str, Any] = {}
            if brand is not UNSET:
                update_kwargs["brand"] = brand
            if model is not UNSET:
                update_kwargs["model"] = model
            if color is not UNSET:
                update_kwargs["color"] = color

            vehicle.update(**update_kwargs)
            after = (vehicle.brand, vehicle.model, vehicle.color)

            if after != before:
                self._vehicle_repository.save(vehicle)

        return VehicleDto.from_entity(vehicle)
