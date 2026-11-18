"""Consumidor Apache Kafka (confluent-kafka) para eventos de Wash Order con Inbox idempotente."""

from __future__ import annotations

import logging
from typing import Any, Callable

from confluent_kafka import Consumer, KafkaError

from application.commands.apply_wash_order_event import ApplyWashOrderEvent
from infrastructure.messaging.order_event_parser import (
    InvalidOrderEventMessageError,
    parse_order_event_message,
)

logger = logging.getLogger(__name__)


class OrderEventConsumerService:
    """Consume eventos de Wash Order y confirma offsets manualmente solo tras commit en BD."""

    def __init__(
        self,
        *,
        apply_order_event: ApplyWashOrderEvent,
        brokers: tuple[str, ...],
        client_id: str,
        group_id: str,
        topics: tuple[str, ...],
        auto_offset_reset: str = "earliest",
        consumer: Any = None,
    ) -> None:
        if not brokers:
            raise ValueError("OrderEventConsumerService requiere al menos un broker Kafka.")
        if not topics:
            raise ValueError("OrderEventConsumerService requiere al menos un topic Kafka.")
        self._apply_order_event = apply_order_event
        self._brokers = brokers
        self._client_id = client_id
        self._group_id = group_id
        self._topics = topics
        self._auto_offset_reset = auto_offset_reset
        self._consumer = consumer
        self._subscribed = False

    def _get_consumer(self) -> Any:
        if self._consumer is None:
            self._consumer = Consumer(
                {
                    "bootstrap.servers": ",".join(self._brokers),
                    "client.id": self._client_id,
                    "group.id": self._group_id,
                    "auto.offset.reset": self._auto_offset_reset,
                    "enable.auto.commit": False,
                }
            )
        if not self._subscribed:
            self._consumer.subscribe(list(self._topics))
            self._subscribed = True
        return self._consumer

    def handle_raw_message(self, raw_value: bytes | str, *, topic: str) -> str:
        """Deserializa y procesa un mensaje individual; propaga errores transitorios de BD."""
        try:
            parsed = parse_order_event_message(raw_value, topic=topic)
        except InvalidOrderEventMessageError as exc:
            logger.warning("Mensaje inválido descartado en topic=%s: %s", topic, exc)
            return "invalid_message"

        if parsed.status == "unknown_event" or parsed.event is None:
            logger.warning(
                "Evento desconocido ignorado en topic=%s: evento=%s",
                topic,
                parsed.evento,
            )
            return "unknown_event"

        return self._apply_order_event.execute(parsed.event)

    def poll_once(self, *, timeout_seconds: float = 1.0) -> str | None:
        """Lee un mensaje de Kafka, lo procesa y confirma el offset solo si la BD hizo commit."""
        consumer = self._get_consumer()
        msg = consumer.poll(timeout_seconds)
        if msg is None:
            return None

        err = msg.error()
        if err is not None:
            if err.code() == KafkaError._PARTITION_EOF:
                return None
            raise RuntimeError(f"Error de consumo Kafka: {err}")

        topic = msg.topic() or self._topics[0]
        raw_value = msg.value()
        if raw_value is None:
            logger.warning("Mensaje vacío descartado en topic=%s", topic)
            consumer.commit(message=msg, asynchronous=False)
            return "invalid_message"

        # Si handle_raw_message lanza excepción (ej. fallo de BD), NO se ejecuta commit().
        outcome = self.handle_raw_message(raw_value, topic=topic)
        consumer.commit(message=msg, asynchronous=False)
        return outcome

    def close(self) -> None:
        if self._consumer is not None:
            self._consumer.close()
            self._subscribed = False

    def run_forever(
        self,
        *,
        poll_timeout_seconds: float = 1.0,
        max_messages: int | None = None,
        stop_requested: Callable[[], bool] | None = None,
    ) -> int:
        processed_count = 0
        try:
            while stop_requested is None or not stop_requested():
                outcome = self.poll_once(timeout_seconds=poll_timeout_seconds)
                if outcome is not None:
                    processed_count += 1
                    if max_messages is not None and processed_count >= max_messages:
                        break
        finally:
            self.close()
        return processed_count
