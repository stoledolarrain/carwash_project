"""Query: consulta el historial paginado de atención de un cliente (solo lectura)."""

from __future__ import annotations

from uuid import UUID

from application.commands.apply_wash_order_event import ORDER_STATUS_RANK
from application.dto.history_dto import WashHistoryItemDto
from application.dto.pagination_dto import PageDto
from application.errors import CustomerNotFoundError, InvalidRequestError
from application.ports.customer_repository import CustomerRepository
from application.ports.wash_history_repository import WashHistoryRepository
from application.validation import (
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    parse_uuid,
    validate_pagination,
)


class GetCustomerHistory:
    def __init__(
        self,
        *,
        customer_repository: CustomerRepository,
        history_repository: WashHistoryRepository,
    ) -> None:
        self._customer_repository = customer_repository
        self._history_repository = history_repository

    def execute(
        self,
        *,
        customer_id: UUID | str,
        status: str | None = None,
        page: int = DEFAULT_PAGE,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> PageDto[WashHistoryItemDto]:
        resolved_customer_id = parse_uuid(customer_id, "customer_id")
        resolved_page, resolved_page_size = validate_pagination(page, page_size)

        normalized_status: str | None = None
        if status is not None:
            if not isinstance(status, str) or status.strip().upper() not in ORDER_STATUS_RANK:
                raise InvalidRequestError(
                    "El filtro 'status' debe ser EN_ESPERA, EN_PROCESO, LISTO o ENTREGADO."
                )
            normalized_status = status.strip().upper()

        if not self._customer_repository.exists(resolved_customer_id):
            raise CustomerNotFoundError(resolved_customer_id)

        items, total = self._history_repository.list_by_customer(
            resolved_customer_id,
            status=normalized_status,
            page=resolved_page,
            page_size=resolved_page_size,
        )
        return PageDto(
            items=tuple(items),
            total=total,
            page=resolved_page,
            page_size=resolved_page_size,
        )
