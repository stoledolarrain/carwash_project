"""Serializers de entrada y salida HTTP para Customer."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from application.dto.customer_dto import CustomerDto
from presentation.serializers.common import (
    StrictCharField,
    StrictInputSerializer,
    format_iso_utc,
    parse_pagination_params,
)


class RegisterCustomerInputSerializer(StrictInputSerializer):
    name = StrictCharField(required=True)
    phone = StrictCharField(required=True)
    email = StrictCharField(required=False, allow_null=True, default=None)


class UpdateCustomerInputSerializer(StrictInputSerializer):
    name = StrictCharField(required=False)
    phone = StrictCharField(required=False)
    email = StrictCharField(required=False, allow_null=True)


def parse_customer_search_params(query_params: dict[str, Any]) -> dict[str, Any]:
    """Parsea query, is_active/isActive, page y page_size/pageSize de la URL."""
    page, page_size = parse_pagination_params(
        query_params,
        allowed_extra=frozenset({"query", "is_active", "isActive"}),
    )

    if "is_active" in query_params and "isActive" in query_params:
        raise serializers.ValidationError(
            {"isActive": ["Utiliza únicamente 'is_active' o 'isActive', no ambos."]}
        )

    is_active: bool | None = None
    active_key = "is_active" if "is_active" in query_params else "isActive"
    if active_key in query_params:
        raw_bool = str(query_params.get(active_key, "")).strip().lower()
        if raw_bool == "true":
            is_active = True
        elif raw_bool == "false":
            is_active = False
        else:
            raise serializers.ValidationError(
                {active_key: ["El filtro solo admite 'true' o 'false'."]}
            )

    raw_query = query_params.get("query")
    return {
        "query": raw_query if raw_query is not None else None,
        "is_active": is_active,
        "page": page,
        "page_size": page_size,
    }


def serialize_customer(dto: CustomerDto) -> dict[str, Any]:
    return {
        "id": str(dto.id),
        "name": dto.name,
        "phone": dto.phone,
        "email": dto.email,
        "isActive": dto.is_active,
        "createdAt": format_iso_utc(dto.created_at),
        "updatedAt": format_iso_utc(dto.updated_at),
    }
