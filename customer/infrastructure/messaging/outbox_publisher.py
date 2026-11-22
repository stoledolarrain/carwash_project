"""Servicio de despacho del Transactional Outbox hacia Apache Kafka."""

from __future__ import annotations

import logging
import time
from typing import Callable

from infrastructure.messaging.kafka_producer import KafkaOutboxProducer
from infrastructure.outbox import DjangoOutboxRepository

logger = logging.getLogger(__name__)


class OutboxPublisherService:
    """Procesa lotes pendientes de outbox_events y los publica mediante KafkaOutboxProducer."""

    def __init__(
        self,
        *,
        outbox_repository: DjangoOutboxRepository,
        producer: KafkaOutboxProducer,
        batch_size: int = 50,
        poll_interval_ms: int = 5000,
    ) -> None:
        self._outbox_repository = outbox_repository
        self._producer = producer
        self._batch_size = batch_size
        self._poll_interval_ms = poll_interval_ms

    def publish_once(self, *, limit: int | None = None) -> dict[str, int]:
        effective_limit = self._batch_size if limit is None else limit
        stats = self._outbox_repository.process_pending_batch(
            publish_one=self._producer.publish_record,
            limit=effective_limit,
        )
        if stats["processed"] > 0:
            logger.info(
                "Ciclo Outbox completado: processed=%d published=%d failed=%d",
                stats["processed"],
                stats["published"],
                stats["failed"],
            )
        return stats

    def run_forever(
        self,
        *,
        stop_requested: Callable[[], bool] | None = None,
    ) -> None:
        sleep_seconds = max(self._poll_interval_ms / 1000.0, 0.1)
        while stop_requested is None or not stop_requested():
            self.publish_once()
            if stop_requested is not None and stop_requested():
                break
            time.sleep(sleep_seconds)
