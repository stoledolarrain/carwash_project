"""Utilidades comunes para serializers HTTP en camelCase."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

from rest_framework import serializers

from application.dto.pagination_dto import PageDto
from application.validation import DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

T = TypeVar("T")


def format_iso_utc(dt: datetime) -> str:
    """Formatea una fecha UTC en ISO-8601 con sufijo Z (consistente con Catalog e Identity)."""
    utc_dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
    return utc_dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


class StrictCharField(serializers.CharField):
    """CharField estricto: rechaza números/booleanos y deja la normalización a Domain."""

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("trim_whitespace", False)
        kwargs.setdefault("allow_blank", True)
        super().__init__(**kwargs)

    def to_internal_value(self, data: Any) -> str:
        if not isinstance(data, str):
            self.fail("invalid")
        return data


class StrictInputSerializer(serializers.Serializer):
    """Serializer base que exige objeto JSON y rechaza propiedades desconocidas."""

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            raise serializers.ValidationError(
                {"body": ["El cuerpo de la petición debe ser un objeto JSON válido."]}
            )

        unknown = sorted(set(data.keys()) - set(self.fields.keys()))
        if unknown:
            raise serializers.ValidationError(
                {field: ["Propiedad no permitida en el cuerpo de la petición."] for field in unknown}
            )

        return super().to_internal_value(data)


def parse_positive_int_param(raw: Any, field_name: str, *, max_value: int | None = None) -> int:
    if not isinstance(raw, str) or not raw.strip().isdigit():
        raise serializers.ValidationError(
            {field_name: [f"El parámetro '{field_name}' debe ser un entero positivo."]}
        )
    value = int(raw.strip())
    if value < 1:
        raise serializers.ValidationError(
            {field_name: [f"El parámetro '{field_name}' debe ser mayor o igual a 1."]}
        )
    if max_value is not None and value > max_value:
        raise serializers.ValidationError(
            {field_name: [f"El parámetro '{field_name}' no puede superar {max_value}."]}
        )
    return value


def parse_pagination_params(
    query_params: dict[str, Any],
    *,
    allowed_extra: frozenset[str] = frozenset(),
) -> tuple[int, int]:
    """Valida parámetros de paginación (admite page_size y pageSize) rechazando desconocidos."""
    allowed = frozenset({"page", "page_size", "pageSize"}) | allowed_extra
    unknown = sorted(set(query_params.keys()) - allowed)
    if unknown:
        raise serializers.ValidationError(
            {field: ["Parámetro de consulta no permitido."] for field in unknown}
        )

    if "page_size" in query_params and "pageSize" in query_params:
        raise serializers.ValidationError(
            {"pageSize": ["Utiliza únicamente 'page_size' o 'pageSize', no ambos."]}
        )

    page = (
        DEFAULT_PAGE
        if "page" not in query_params
        else parse_positive_int_param(query_params.get("page"), "page")
    )

    raw_size_key = "page_size" if "page_size" in query_params else "pageSize"
    page_size = (
        DEFAULT_PAGE_SIZE
        if raw_size_key not in query_params
        else parse_positive_int_param(
            query_params.get(raw_size_key),
            raw_size_key,
            max_value=MAX_PAGE_SIZE,
        )
    )

    return page, page_size


def serialize_page(page_dto: PageDto[T], serialize_item: Callable[[T], dict[str, Any]]) -> dict[str, Any]:
    return {
        "items": [serialize_item(item) for item in page_dto.items],
        "total": page_dto.total,
        "page": page_dto.page,
        "pageSize": page_dto.page_size,
    }
