"""Query: lista los vehículos asociados a un cliente existente con paginación (solo lectura)."""

from __future__ import annotations

from uuid import UUID

from application.dto.pagination_dto import PageDto
from application.dto.vehicle_dto import VehicleDto
from application.errors import CustomerNotFoundError
from application.ports.customer_repository import CustomerRepository
from application.ports.vehicle_repository import VehicleRepository
from application.validation import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, validate_pagination, parse_uuid


class ListVehiclesByCustomer:
    def __init__(
        self,
        *,
        vehicle_repository: VehicleRepository,
        customer_repository: CustomerRepository,
    ) -> None:
        self._vehicle_repository = vehicle_repository
        self._customer_repository = customer_repository

    def execute(
        self,
        *,
        customer_id: UUID | str,
        page: int = DEFAULT_PAGE,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> PageDto[VehicleDto]:
        resolved_customer_id = parse_uuid(customer_id, "customer_id")
        resolved_page, resolved_page_size = validate_pagination(page, page_size)

        if not self._customer_repository.exists(resolved_customer_id):
            raise CustomerNotFoundError(resolved_customer_id)

        vehicles, total = self._vehicle_repository.list_by_customer(
            resolved_customer_id,
            page=resolved_page,
            page_size=resolved_page_size,
        )

        return PageDto(
            items=tuple(VehicleDto.from_entity(v) for v in vehicles),
            total=total,
            page=resolved_page,
            page_size=resolved_page_size,
        )
