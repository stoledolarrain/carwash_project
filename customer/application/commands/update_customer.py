"""Command: actualiza los datos básicos de un cliente (incluso si está inactivo)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from application.dto.customer_dto import CustomerDto
from application.errors import CustomerNotFoundError, InvalidRequestError
from application.ports.customer_repository import CustomerRepository
from application.ports.unit_of_work import UnitOfWork
from application.validation import UNSET, parse_uuid


class UpdateCustomer:
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
        customer_id: UUID | str,
        name: Any = UNSET,
        phone: Any = UNSET,
        email: Any = UNSET,
    ) -> CustomerDto:
        if name is UNSET and phone is UNSET and email is UNSET:
            raise InvalidRequestError(
                "Debe especificar al menos uno de: 'name', 'phone' o 'email'."
            )

        resolved_id = parse_uuid(customer_id, "customer_id")

        with self._uow.atomic():
            customer = self._customer_repository.find_by_id(resolved_id)
            if customer is None:
                raise CustomerNotFoundError(resolved_id)

            before = (customer.name, customer.phone, customer.email)
            update_kwargs: dict[str, Any] = {}
            if name is not UNSET:
                update_kwargs["name"] = name
            if phone is not UNSET:
                update_kwargs["phone"] = phone
            if email is not UNSET:
                update_kwargs["email"] = email

            customer.update(**update_kwargs)
            after = (customer.name, customer.phone, customer.email)

            if after != before:
                self._customer_repository.save(customer)

        return CustomerDto.from_entity(customer)
