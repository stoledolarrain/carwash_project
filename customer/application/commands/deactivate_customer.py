"""Command: desactiva un cliente activo respetando las reglas del dominio."""

from __future__ import annotations

from uuid import UUID

from application.dto.customer_dto import CustomerDto
from application.errors import CustomerNotFoundError
from application.ports.customer_repository import CustomerRepository
from application.ports.unit_of_work import UnitOfWork
from application.validation import parse_uuid


class DeactivateCustomer:
    def __init__(
        self,
        *,
        customer_repository: CustomerRepository,
        uow: UnitOfWork,
    ) -> None:
        self._customer_repository = customer_repository
        self._uow = uow

    def execute(self, *, customer_id: UUID | str) -> CustomerDto:
        resolved_id = parse_uuid(customer_id, "customer_id")

        with self._uow.atomic():
            customer = self._customer_repository.find_by_id(resolved_id)
            if customer is None:
                raise CustomerNotFoundError(resolved_id)

            customer.deactivate()
            self._customer_repository.save(customer)

        return CustomerDto.from_entity(customer)
