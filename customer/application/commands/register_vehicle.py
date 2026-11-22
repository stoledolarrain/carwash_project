"""Command: registra un vehículo por placa, validando unicidad y cliente opcional activo."""

from __future__ import annotations

from uuid import UUID

from application.dto.vehicle_dto import VehicleDto
from application.errors import (
    CustomerInactiveError,
    CustomerNotFoundError,
    DuplicatePlateError,
)
from application.ports.customer_repository import CustomerRepository
from application.ports.unit_of_work import UnitOfWork
from application.ports.vehicle_repository import VehicleRepository
from application.validation import parse_uuid
from domain.entities.vehicle import Vehicle


class RegisterVehicle:
    def __init__(
        self,
        *,
        vehicle_repository: VehicleRepository,
        customer_repository: CustomerRepository,
        uow: UnitOfWork,
    ) -> None:
        self._vehicle_repository = vehicle_repository
        self._customer_repository = customer_repository
        self._uow = uow

    def execute(
        self,
        *,
        plate: str,
        brand: str,
        model: str,
        color: str | None = None,
        customer_id: UUID | str | None = None,
    ) -> VehicleDto:
        resolved_customer_id = (
            None if customer_id is None else parse_uuid(customer_id, "customer_id")
        )

        # El dominio valida las invariantes del vehículo antes de consultar persistencia.
        vehicle = Vehicle.create(
            plate=plate,
            brand=brand,
            model=model,
            color=color,
            customer_id=resolved_customer_id,
        )

        with self._uow.atomic():
            if self._vehicle_repository.exists_by_plate(vehicle.plate):
                raise DuplicatePlateError(vehicle.plate.value)

            if resolved_customer_id is not None:
                customer = self._customer_repository.find_by_id(resolved_customer_id)
                if customer is None:
                    raise CustomerNotFoundError(resolved_customer_id)
                if not customer.is_active:
                    raise CustomerInactiveError(resolved_customer_id)

            self._vehicle_repository.save(vehicle)

        return VehicleDto.from_entity(vehicle)
