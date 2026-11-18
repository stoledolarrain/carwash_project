"""Productor Apache Kafka (confluent-kafka) para publicar eventos del Outbox."""

from __future__ import annotations

import json
from typing import Any

from confluent_kafka import Producer

from infrastructure.models import OutboxEventModel


class KafkaOutboxProducer:
    """Publica registros de outbox_events en Kafka esperando confirmación de entrega."""

    def __init__(
        self,
        *,
        brokers: tuple[str, ...],
        client_id: str,
        flush_timeout_seconds: float = 10.0,
        producer: Any = None,
    ) -> None:
        if not brokers:
            raise ValueError("KafkaOutboxProducer requiere al menos un broker Kafka.")
        self._brokers = brokers
        self._client_id = client_id
        self._flush_timeout_seconds = flush_timeout_seconds
        self._producer = producer

    def _get_producer(self) -> Any:
        if self._producer is None:
            self._producer = Producer(
                {
                    "bootstrap.servers": ",".join(self._brokers),
                    "client.id": self._client_id,
                    "acks": "all",
                    "enable.idempotence": True,
                }
            )
        return self._producer

    def publish_record(self, record: OutboxEventModel) -> None:
        """Publica un evento del Outbox usando aggregate_id como clave de partición."""
        producer = self._get_producer()
        serialized = json.dumps(record.payload, ensure_ascii=False).encode("utf-8")
        key = str(record.aggregate_id).encode("utf-8")
        delivery_error: list[Any] = []

        def _on_delivery(err: Any, _msg: Any) -> None:
            if err is not None:
                delivery_error.append(err)

        producer.produce(
            topic=record.topic,
            key=key,
            value=serialized,
            on_delivery=_on_delivery,
        )
        remaining = producer.flush(self._flush_timeout_seconds)

        if delivery_error:
            raise RuntimeError(f"Error de entrega Kafka: {delivery_error[0]}")
        if remaining:
            raise TimeoutError(
                f"Tiempo agotado al confirmar publicación en Kafka ({remaining} mensaje(s) pendiente(s))."
            )
