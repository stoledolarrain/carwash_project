"""Repositorio PostgreSQL de Inbox idempotente (deduplicación atómica por event_id)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from django.db import connection


class DjangoInboxRepository:
    """Registra eventos procesados en inbox_events usando ON CONFLICT DO NOTHING."""

    def register_if_new(
        self,
        *,
        event_id: UUID,
        evento: str,
        aggregate_id: UUID,
        topic: str,
    ) -> bool:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO inbox_events (event_id, evento, aggregate_id, topic, received_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (event_id) DO NOTHING
                """,
                [
                    event_id,
                    evento,
                    aggregate_id,
                    topic,
                    datetime.now(timezone.utc),
                ],
            )
            return cursor.rowcount == 1
