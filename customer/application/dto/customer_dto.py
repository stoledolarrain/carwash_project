"""DTO inmutable para representar un cliente fuera de la capa Domain."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from domain.entities.customer import Customer


@dataclass(frozen=True)
class CustomerDto:
    id: UUID
    name: str
    phone: str
    email: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_entity(cls, customer: Customer) -> CustomerDto:
        return cls(
            id=customer.id,
            name=customer.name,
            phone=customer.phone.value,
            email=customer.email.value if customer.email is not None else None,
            is_active=customer.is_active,
            created_at=customer.created_at,
            updated_at=customer.updated_at,
        )
