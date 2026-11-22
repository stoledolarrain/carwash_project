"""Puerto de Unidad de Trabajo (Unit of Work) para delimitar transacciones."""

from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Protocol


class UnitOfWork(Protocol):
    def atomic(self) -> AbstractContextManager[None]:
        """Abre un bloque transaccional: confirma al salir sin error o revierte ante excepción."""
        ...
