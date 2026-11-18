"""Command: registra un nuevo cliente en el servicio."""

from __future__ import annotations

from application.dto.customer_dto import CustomerDto
from application.ports.customer_repository import CustomerRepository
from application.ports.unit_of_work import UnitOfWork
from domain.entities.customer import Customer


class RegisterCustomer:
    def __init__(
        self,
        *,
        customer_repository: CustomerRepository,
        uow: UnitOfWork,
    ) -> None:
        self._customer_repository = customer_repository
        self._uow = uow

    def execute(
        self,
        *,
        name: str,
        phone: str,
        email: str | None = None,
    ) -> CustomerDto:
        customer = Customer.create(name=name, phone=phone, email=email)

        with self._uow.atomic():
            self._customer_repository.save(customer)

        return CustomerDto.from_entity(customer)
