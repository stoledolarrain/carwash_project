"""Puerto de Inbox idempotente para deduplicar eventos consumidos por event_id."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID


class InboxRepository(Protocol):
    def register_if_new(
        self,
        *,
        event_id: UUID,
        evento: str,
        aggregate_id: UUID,
        topic: str,
    ) -> bool:
        """Registra el event_id si no existía. Devuelve True si es nuevo, False si es duplicado."""
        ...
