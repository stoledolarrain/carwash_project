"""Query: obtiene un cliente por su UUID (solo lectura)."""

from __future__ import annotations

from uuid import UUID

from application.dto.customer_dto import CustomerDto
from application.errors import CustomerNotFoundError
from application.ports.customer_repository import CustomerRepository
from application.validation import parse_uuid


class GetCustomerById:
    def __init__(self, *, customer_repository: CustomerRepository) -> None:
        self._customer_repository = customer_repository

    def execute(self, *, customer_id: UUID | str) -> CustomerDto:
        resolved_id = parse_uuid(customer_id, "customer_id")
        customer = self._customer_repository.find_by_id(resolved_id)
        if customer is None:
            raise CustomerNotFoundError(resolved_id)
        return CustomerDto.from_entity(customer)
