"""Command: asocia, reasigna o desasocia (con None) el cliente de un vehículo."""

from __future__ import annotations

from uuid import UUID

from application.dto.vehicle_dto import VehicleDto
from application.errors import (
    CustomerInactiveError,
    CustomerNotFoundError,
    VehicleNotFoundError,
)
from application.ports.customer_repository import CustomerRepository
from application.ports.unit_of_work import UnitOfWork
from application.ports.vehicle_repository import VehicleRepository
from application.validation import parse_uuid


class ChangeVehicleCustomer:
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
        vehicle_id: UUID | str,
        customer_id: UUID | str | None,
    ) -> VehicleDto:
        resolved_vehicle_id = parse_uuid(vehicle_id, "vehicle_id")
        resolved_customer_id = (
            None if customer_id is None else parse_uuid(customer_id, "customer_id")
        )

        with self._uow.atomic():
            vehicle = self._vehicle_repository.find_by_id(resolved_vehicle_id)
            if vehicle is None:
                raise VehicleNotFoundError(resolved_vehicle_id)

            if resolved_customer_id is not None:
                customer = self._customer_repository.find_by_id(resolved_customer_id)
                if customer is None:
                    raise CustomerNotFoundError(resolved_customer_id)
                if not customer.is_active:
                    raise CustomerInactiveError(resolved_customer_id)

            previous_customer_id = vehicle.customer_id
            vehicle.associate_customer(resolved_customer_id)

            if vehicle.customer_id != previous_customer_id:
                self._vehicle_repository.save(vehicle)

        return VehicleDto.from_entity(vehicle)
