"""DTO genérico e inmutable para respuestas paginadas de lectura."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class PageDto(Generic[T]):
    items: tuple[T, ...]
    total: int
    page: int
    page_size: int
