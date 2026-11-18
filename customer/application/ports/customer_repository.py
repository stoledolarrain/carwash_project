"""Puerto de persistencia y consulta para el agregado Customer."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from domain.entities.customer import Customer


class CustomerRepository(Protocol):
    def save(self, customer: Customer) -> None:
        """Persiste un cliente nuevo o actualizado."""
        ...

    def find_by_id(self, customer_id: UUID) -> Customer | None:
        """Busca un cliente por su UUID o devuelve None si no existe."""
        ...

    def exists(self, customer_id: UUID) -> bool:
        """Indica si existe un cliente registrado con el UUID dado."""
        ...

    def search(
        self,
        *,
        query: str | None = None,
        is_active: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Customer], int]:
        """Busca y pagina clientes por texto y estado activo; devuelve (items, total)."""
        ...
