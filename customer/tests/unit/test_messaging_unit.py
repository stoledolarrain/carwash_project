"""Pruebas unitarias de mensajería Kafka (parser, productor y consumidor sin broker real)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from infrastructure.messaging.kafka_consumer import OrderEventConsumerService
from infrastructure.messaging.kafka_producer import KafkaOutboxProducer
from infrastructure.messaging.order_event_parser import (
    InvalidOrderEventMessageError,
    parse_order_event_message,
)
from infrastructure.models import OutboxEventModel
from infrastructure.outbox import sanitize_error_message


def _make_wash_order_envelope(
    *,
    evento: str = "WashOrderCreated",
    order_id: str | None = None,
    cliente_id: str | None = None,
    estado: str = "EN_ESPERA",
    responsable_id: str | None = None,
    fecha_entrega: str | None = None,
    origen: str = "wash-order-service",
) -> dict:
    oid = order_id or str(uuid4())
    datos: dict = {
        "id": oid,
        "placaVehiculo": "1234-ABC",
        "clienteId": cliente_id,
        "servicios": ["LAVADO_BASICO", "ENCERADO"],
        "precioTotal": 85.5,
        "responsableId": responsable_id,
        "estado": estado,
        "fechaCreacion": "2026-11-18T01:00:00.000Z",
    }
    if fecha_entrega is not None:
        datos["fechaEntrega"] = fecha_entrega
    return {
        "eventId": str(uuid4()),
        "evento": evento,
        "origen": origen,
        "eventVersion": 1,
        "fechaEmision": "2026-11-18T01:00:05.000Z",
        "aggregateId": oid,
        "datos": datos,
    }


class _FakeKafkaMessage:
    def __init__(self, value: bytes | None, topic: str = "wash-order.order.events") -> None:
        self._value = value
        self._topic = topic

    def error(self):
        return None

    def topic(self) -> str:
        return self._topic

    def value(self) -> bytes | None:
        return self._value


class _FakeKafkaConsumer:
    def __init__(self, messages: list[_FakeKafkaMessage | None]) -> None:
        self._messages = list(messages)
        self.subscribed_topics: list[str] = []
        self.committed: list[_FakeKafkaMessage] = []
        self.closed = False

    def subscribe(self, topics: list[str]) -> None:
        self.subscribed_topics = topics

    def poll(self, _timeout: float):
        return self._messages.pop(0) if self._messages else None

    def commit(self, *, message, asynchronous: bool = False) -> None:
        assert asynchronous is False
        self.committed.append(message)

    def close(self) -> None:
        self.closed = True


class TestOrderEventParser:
    def test_parses_valid_wash_order_event_with_full_payload(self) -> None:
        customer_id = str(uuid4())
        envelope = _make_wash_order_envelope(
            evento="WashDelivered",
            cliente_id=customer_id,
            estado="ENTREGADO",
            responsable_id="EMP-01",
            fecha_entrega="2026-11-18T02:00:00.000Z",
        )

        parsed = parse_order_event_message(
            json.dumps(envelope).encode("utf-8"),
            topic="wash-order.order.events",
        )

        assert parsed.status == "valid"
        assert parsed.event is not None
        assert parsed.event.evento == "WashDelivered"
        assert str(parsed.event.customer_id) == customer_id
        assert parsed.event.plate == "1234-ABC"
        assert parsed.event.services == ("LAVADO_BASICO", "ENCERADO")
        assert parsed.event.total_price == Decimal("85.50")
        assert parsed.event.responsible_id == "EMP-01"
        assert parsed.event.status == "ENTREGADO"
        assert parsed.event.delivered_at is not None

    def test_returns_unknown_event_for_unrecognized_event_name(self) -> None:
        envelope = _make_wash_order_envelope(evento="WashOrderCancelled")
        parsed = parse_order_event_message(json.dumps(envelope), topic="wash-order.order.events")

        assert parsed.status == "unknown_event"
        assert parsed.event is None

    @pytest.mark.parametrize(
        "raw",
        [
            b"\xff\xfe",
            "{json-roto",
            "[]",
            json.dumps({"evento": "WashOrderCreated"}),  # faltan campos
            json.dumps(_make_wash_order_envelope(cliente_id="CLI-100")),  # clienteId no UUID
            json.dumps(_make_wash_order_envelope(origen="otro-servicio")),
            json.dumps(_make_wash_order_envelope(estado="DESCONOCIDO")),
        ],
    )
    def test_rejects_invalid_messages(self, raw: bytes | str) -> None:
        with pytest.raises(InvalidOrderEventMessageError):
            parse_order_event_message(raw, topic="wash-order.order.events")


class TestKafkaConsumerAndProducerUnit:
    def test_consumer_does_not_commit_offset_when_application_fails(self) -> None:
        envelope = _make_wash_order_envelope()
        msg = _FakeKafkaMessage(json.dumps(envelope).encode("utf-8"))
        fake_consumer = _FakeKafkaConsumer([msg])

        class _FailingUseCase:
            def execute(self, _event):
                raise RuntimeError("Fallo transitorio de PostgreSQL")

        service = OrderEventConsumerService(
            apply_order_event=_FailingUseCase(),  # type: ignore[arg-type]
            brokers=("localhost:9092",),
            client_id="customer-service",
            group_id="customer-service-group",
            topics=("wash-order.order.events",),
            consumer=fake_consumer,
        )

        with pytest.raises(RuntimeError, match="Fallo transitorio"):
            service.poll_once()

        # Nunca debe confirmar el offset si la transacción en BD falló
        assert fake_consumer.committed == []
        assert fake_consumer.subscribed_topics == ["wash-order.order.events"]

    def test_consumer_commits_unknown_and_invalid_messages_without_crashing(self) -> None:
        m1 = _FakeKafkaMessage(b"{corrupto")
        m2 = _FakeKafkaMessage(
            json.dumps(_make_wash_order_envelope(evento="EventoInventado")).encode("utf-8")
        )
        fake_consumer = _FakeKafkaConsumer([m1, m2])

        class _UnusedUseCase:
            def execute(self, _event):
                raise AssertionError("No debe invocarse para mensajes inválidos o desconocidos")

        service = OrderEventConsumerService(
            apply_order_event=_UnusedUseCase(),  # type: ignore[arg-type]
            brokers=("localhost:9092",),
            client_id="customer-service",
            group_id="customer-service-group",
            topics=("wash-order.order.events",),
            consumer=fake_consumer,
        )

        assert service.poll_once() == "invalid_message"
        assert service.poll_once() == "unknown_event"
        assert fake_consumer.committed == [m1, m2]

    def test_kafka_outbox_producer_sends_key_and_payload_and_raises_on_delivery_error(self) -> None:
        sent: list[dict] = []

        class _FakeProducer:
            def __init__(self, fail: bool = False) -> None:
                self._fail = fail

            def produce(self, *, topic, key, value, on_delivery) -> None:
                if self._fail:
                    on_delivery("Broker unavailable", None)
                else:
                    sent.append({"topic": topic, "key": key, "value": value})
                    on_delivery(None, None)

            def flush(self, _timeout: float) -> int:
                return 0

        record = OutboxEventModel(
            id=uuid4(),
            event_name="CustomerRegistered",
            aggregate_id=uuid4(),
            topic="customer.customer.registered",
            payload={"eventId": "e1", "evento": "CustomerRegistered"},
            created_at=datetime.now(timezone.utc),
        )

        ok_producer = KafkaOutboxProducer(
            brokers=("localhost:9092",),
            client_id="customer-service",
            producer=_FakeProducer(fail=False),
        )
        ok_producer.publish_record(record)
        assert len(sent) == 1
        assert sent[0]["topic"] == "customer.customer.registered"
        assert sent[0]["key"] == str(record.aggregate_id).encode("utf-8")

        failing_producer = KafkaOutboxProducer(
            brokers=("localhost:9092",),
            client_id="customer-service",
            producer=_FakeProducer(fail=True),
        )
        with pytest.raises(RuntimeError, match="Error de entrega Kafka"):
            failing_producer.publish_record(record)

    def test_sanitize_error_message_redacts_secrets_and_postgres_urls(self) -> None:
        raw = "Fallo con postgresql://postgres:supersecret@localhost:5432/customer_db y token=abc123"
        sanitized = sanitize_error_message(raw)

        assert "supersecret" not in sanitized
        assert "abc123" not in sanitized
        assert "postgresql://[REDACTED]" in sanitized
        assert "token=[REDACTED]" in sanitized
