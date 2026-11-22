"""Query: lista y busca clientes por texto y estado activo con paginación (solo lectura)."""

from __future__ import annotations

from application.dto.customer_dto import CustomerDto
from application.dto.pagination_dto import PageDto
from application.errors import InvalidRequestError
from application.ports.customer_repository import CustomerRepository
from application.validation import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, validate_pagination


class SearchCustomers:
    def __init__(self, *, customer_repository: CustomerRepository) -> None:
        self._customer_repository = customer_repository

    def execute(
        self,
        *,
        query: str | None = None,
        is_active: bool | None = None,
        page: int = DEFAULT_PAGE,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> PageDto[CustomerDto]:
        resolved_page, resolved_page_size = validate_pagination(page, page_size)

        if is_active is not None and not isinstance(is_active, bool):
            raise InvalidRequestError("El filtro 'is_active' debe ser booleano.")

        if query is not None and not isinstance(query, str):
            raise InvalidRequestError("El parámetro de búsqueda 'query' debe ser texto.")

        normalized_query = query.strip() if query is not None else None
        if normalized_query == "":
            normalized_query = None

        customers, total = self._customer_repository.search(
            query=normalized_query,
            is_active=is_active,
            page=resolved_page,
            page_size=resolved_page_size,
        )

        return PageDto(
            items=tuple(CustomerDto.from_entity(c) for c in customers),
            total=total,
            page=resolved_page,
            page_size=resolved_page_size,
        )
