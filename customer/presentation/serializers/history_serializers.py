"""Serializers HTTP para la consulta de historial de lavados en camelCase."""

from __future__ import annotations

from typing import Any

from application.dto.history_dto import WashHistoryItemDto
from presentation.serializers.common import format_iso_utc, parse_pagination_params


def parse_history_query_params(query_params: dict[str, Any]) -> dict[str, Any]:
    """Parsea status, page y page_size/pageSize rechazando parámetros desconocidos."""
    page, page_size = parse_pagination_params(
        query_params,
        allowed_extra=frozenset({"status"}),
    )
    raw_status = query_params.get("status")
    return {
        "status": raw_status if raw_status is not None else None,
        "page": page,
        "page_size": page_size,
    }


def serialize_history_item(dto: WashHistoryItemDto) -> dict[str, Any]:
    return {
        "orderId": str(dto.order_id),
        "plate": dto.plate,
        "customerId": str(dto.customer_id) if dto.customer_id is not None else None,
        "services": list(dto.services),
        "totalPrice": float(dto.total_price),
        "responsibleId": dto.responsible_id,
        "status": dto.status,
        "createdAt": format_iso_utc(dto.created_at),
        "deliveredAt": format_iso_utc(dto.delivered_at) if dto.delivered_at is not None else None,
    }
