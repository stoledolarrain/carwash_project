"""Utilidades ligeras de validación para casos de uso de Application."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from application.errors import InvalidRequestError

DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

UNSET: Any = object()


def parse_uuid(value: UUID | str, field_name: str = "id") -> UUID:
    """Valida y convierte un UUID recibido por un caso de uso."""
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        try:
            return UUID(value.strip())
        except ValueError as exc:
            raise InvalidRequestError(f"El campo '{field_name}' debe ser un UUID válido.") from exc
    raise InvalidRequestError(f"El campo '{field_name}' debe ser un UUID válido.")


def validate_pagination(
    page: int = DEFAULT_PAGE,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[int, int]:
    """Valida los parámetros de paginación (enteros positivos, page_size <= 100)."""
    if isinstance(page, bool) or not isinstance(page, int) or page < 1:
        raise InvalidRequestError("El parámetro 'page' debe ser un entero mayor o igual a 1.")
    if isinstance(page_size, bool) or not isinstance(page_size, int) or page_size < 1:
        raise InvalidRequestError("El parámetro 'page_size' debe ser un entero mayor o igual a 1.")
    if page_size > MAX_PAGE_SIZE:
        raise InvalidRequestError(f"El parámetro 'page_size' no puede superar {MAX_PAGE_SIZE}.")
    return page, page_size
