"""Pruebas de integración de Outbox, Inbox idempotente, WashHistory y endpoints de historial."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import jwt
import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from application.commands.apply_wash_order_event import ApplyWashOrderEvent
from config.container import build_container, build_order_event_consumer, build_outbox_publisher
from config.env import JwtConfig
from infrastructure.inbox import DjangoInboxRepository
from infrastructure.models import InboxEventModel, OutboxEventModel, WashHistoryModel
from infrastructure.unit_of_work import DjangoUnitOfWork

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.integration]

TEST_JWT_SECRET = "test-jwt-secret-para-pruebas-historial-customer-32chars"
TEST_JWT_ISSUER = "carwash-identity"
TEST_JWT_AUDIENCE = "carwash-platform"
MISSING_UUID = "99999999-9999-4999-8999-999999999999"


@pytest.fixture(autouse=True)
def _configure_test_jwt(settings) -> None:
    settings.JWT_CONFIG = JwtConfig(
        secret=TEST_JWT_SECRET,
        issuer=TEST_JWT_ISSUER,
        audience=TEST_JWT_AUDIENCE,
    )


def _auth_client(*, role: str = "ADMIN") -> APIClient:
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(uuid4()),
            "role": role,
            "tv": 1,
            "iss": TEST_JWT_ISSUER,
            "aud": TEST_JWT_AUDIENCE,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(hours=1)).timestamp()),
        },
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _build_order_event(
    *,
    evento: str,
    order_id: str,
    plate: str,
    customer_id: str | None,
    estado: str,
    created_at: str = "2026-11-18T01:00:00.000Z",
    delivered_at: str | None = None,
    responsable_id: str | None = None,
    precio_total: float = 85.5,
    servicios: list[str] | None = None,
    event_id: str | None = None,
) -> bytes:
    datos: dict = {
        "id": order_id,
        "placaVehiculo": plate,
        "clienteId": customer_id,
        "servicios": servicios or ["LAVADO_BASICO", "ENCERADO"],
        "precioTotal": precio_total,
        "responsableId": responsable_id,
        "estado": estado,
        "fechaCreacion": created_at,
    }
    if delivered_at is not None:
        datos["fechaEntrega"] = delivered_at
    envelope = {
        "eventId": event_id or str(uuid4()),
        "evento": evento,
        "origen": "wash-order-service",
        "eventVersion": 1,
        "fechaEmision": "2026-11-18T01:05:00.000Z",
        "aggregateId": order_id,
        "datos": datos,
    }
    return json.dumps(envelope).encode("utf-8")


class _RecordingProducer:
    def __init__(self, *, fail_when=None) -> None:
        self.sent: list[dict] = []
        self._fail_when = fail_when

    def produce(self, *, topic, key, value, on_delivery) -> None:
        envelope = json.loads(value.decode("utf-8"))
        if self._fail_when and self._fail_when(topic, key.decode("utf-8"), envelope):
            on_delivery("broker unreachable postgresql://user:secret@localhost:5432/db", None)
            return
        self.sent.append({"topic": topic, "key": key.decode("utf-8"), "envelope": envelope})
        on_delivery(None, None)

    def flush(self, _timeout: float) -> int:
        return 0


class TestOutboxPostgresIntegration:
    def test_outbox_publishes_domain_events_preserving_aggregate_order_and_retry_safety(
        self,
    ) -> None:
        container = build_container()
        c_a = container.register_customer.execute(
            name="Cliente A", phone="70011111", email="a@mail.com"
        )
        container.update_customer.execute(customer_id=c_a.id, name="Cliente A Editado")
        c_b = container.register_customer.execute(name="Cliente B", phone="70022222")

        # Ciclo 1: falla CustomerRegistered de c_a -> CustomerUpdated de c_a NO debe adelantarse,
        # pero CustomerRegistered de c_b sí se publica.
        fail_first = True
        producer = _RecordingProducer(
            fail_when=lambda _t, key, env: (
                fail_first and key == str(c_a.id) and env["evento"] == "CustomerRegistered"
            )
        )
        publisher = build_outbox_publisher(container=container, producer=producer, batch_size=10)

        cycle_1 = publisher.publish_once()
        assert cycle_1 == {"processed": 2, "published": 1, "failed": 1}
        assert len(producer.sent) == 1
        assert producer.sent[0]["key"] == str(c_b.id)
        assert producer.sent[0]["topic"] == "customer.customer.registered"
        assert producer.sent[0]["envelope"]["origen"] == "customer-service"
        # Privacidad: sin teléfono ni correo en el evento
        assert "phone" not in producer.sent[0]["envelope"]["datos"]
        assert "email" not in producer.sent[0]["envelope"]["datos"]

        failed_row = OutboxEventModel.objects.get(
            aggregate_id=c_a.id, event_name="CustomerRegistered"
        )
        assert failed_row.attempts == 1
        assert failed_row.published_at is None
        assert "secret" not in (failed_row.last_error or "")
        assert "postgresql://[REDACTED]" in (failed_row.last_error or "")

        # Ciclo 2: se resuelve el fallo -> los dos eventos de c_a salen en orden exacto
        fail_first = False
        cycle_2 = publisher.publish_once()
        assert cycle_2 == {"processed": 2, "published": 2, "failed": 0}
        events_a = [m["envelope"]["evento"] for m in producer.sent if m["key"] == str(c_a.id)]
        assert events_a == ["CustomerRegistered", "CustomerUpdated"]
        assert OutboxEventModel.objects.filter(published_at__isnull=True).count() == 0

    def test_publish_outbox_management_command_once(self) -> None:
        container = build_container()
        container.register_customer.execute(name="Comando Outbox", phone="70033333")
        producer = _RecordingProducer()

        with patch(
            "presentation.management.commands.publish_outbox.build_outbox_publisher",
            return_value=build_outbox_publisher(container=container, producer=producer),
        ):
            call_command("publish_outbox", "--once")

        assert len(producer.sent) == 1
        assert OutboxEventModel.objects.filter(published_at__isnull=True).count() == 0


class TestInboxAndWashHistoryIntegration:
    def test_consumes_full_order_lifecycle_deduplicates_and_prevents_status_regression(
        self,
    ) -> None:
        container = build_container()
        customer = container.register_customer.execute(name="Andrea Rojas", phone="70044444")
        vehicle = container.register_vehicle.execute(
            plate="4821-ABC", brand="Toyota", model="Corolla", customer_id=customer.id
        )
        consumer = build_order_event_consumer(container=container)

        order_id = str(uuid4())
        created_event_id = str(uuid4())

        # 1. WashOrderCreated -> crea fila en wash_history y registra inbox_events
        res_created = consumer.handle_raw_message(
            _build_order_event(
                evento="WashOrderCreated",
                order_id=order_id,
                plate="4821-ABC",
                customer_id=str(customer.id),
                estado="EN_ESPERA",
                event_id=created_event_id,
            ),
            topic="wash-order.order.events",
        )
        assert res_created == "applied"
        assert WashHistoryModel.objects.count() == 1
        assert InboxEventModel.objects.count() == 1

        # 2. Evento duplicado con el mismo eventId -> ignorado por Inbox
        res_dup = consumer.handle_raw_message(
            _build_order_event(
                evento="WashOrderCreated",
                order_id=order_id,
                plate="4821-ABC",
                customer_id=str(customer.id),
                estado="EN_ESPERA",
                event_id=created_event_id,
            ),
            topic="wash-order.order.events",
        )
        assert res_dup == "duplicate"
        assert InboxEventModel.objects.count() == 1

        # 3. WashStarted -> WashCompleted -> WashDelivered actualizan la MISMA fila
        assert (
            consumer.handle_raw_message(
                _build_order_event(
                    evento="WashStarted",
                    order_id=order_id,
                    plate="4821-ABC",
                    customer_id=str(customer.id),
                    estado="EN_PROCESO",
                    responsable_id="EMP-01",
                ),
                topic="wash-order.order.events",
            )
            == "applied"
        )
        assert (
            consumer.handle_raw_message(
                _build_order_event(
                    evento="WashCompleted",
                    order_id=order_id,
                    plate="4821-ABC",
                    customer_id=str(customer.id),
                    estado="LISTO",
                    responsable_id="EMP-01",
                ),
                topic="wash-order.order.events",
            )
            == "applied"
        )
        assert (
            consumer.handle_raw_message(
                _build_order_event(
                    evento="WashDelivered",
                    order_id=order_id,
                    plate="4821-ABC",
                    customer_id=str(customer.id),
                    estado="ENTREGADO",
                    responsable_id="EMP-01",
                    delivered_at="2026-11-18T02:15:00.000Z",
                ),
                topic="wash-order.order.events",
            )
            == "applied"
        )

        # Sigue existiendo UNA sola fila por orden
        assert WashHistoryModel.objects.count() == 1
        row = WashHistoryModel.objects.get(order_id=order_id)
        assert row.status == "ENTREGADO"
        assert row.responsible_id == "EMP-01"
        assert row.delivered_at is not None

        # 4. Evento tardío (WashStarted con nuevo eventId) NO hace retroceder el estado
        res_stale = consumer.handle_raw_message(
            _build_order_event(
                evento="WashStarted",
                order_id=order_id,
                plate="4821-ABC",
                customer_id=str(customer.id),
                estado="EN_PROCESO",
                responsable_id="EMP-01",
            ),
            topic="wash-order.order.events",
        )
        assert res_stale == "stale_ignored"
        assert WashHistoryModel.objects.get(order_id=order_id).status == "ENTREGADO"

        # 5. Orden sin cliente (clienteId=None) asociada al vehículo por placa
        anon_order_id = str(uuid4())
        assert (
            consumer.handle_raw_message(
                _build_order_event(
                    evento="WashOrderCreated",
                    order_id=anon_order_id,
                    plate="4821-ABC",
                    customer_id=None,
                    estado="EN_ESPERA",
                    created_at="2026-11-18T03:00:00.000Z",
                    precio_total=35.0,
                    servicios=["LAVADO_EXPRESS"],
                ),
                topic="wash-order.order.events",
            )
            == "applied"
        )

        # 6. Consultar endpoints REST de historial (cliente y vehículo)
        api = _auth_client(role="RECEPTIONIST")

        cust_hist = api.get(f"/api/customer/customers/{customer.id}/history?page=1&page_size=10")
        assert cust_hist.status_code == 200
        cust_body = cust_hist.json()
        assert cust_body["total"] == 1
        assert cust_body["items"][0]["orderId"] == order_id
        assert cust_body["items"][0]["status"] == "ENTREGADO"
        assert cust_body["items"][0]["totalPrice"] == 85.5
        assert cust_body["items"][0]["services"] == ["LAVADO_BASICO", "ENCERADO"]
        assert cust_body["items"][0]["responsibleId"] == "EMP-01"
        assert cust_body["items"][0]["deliveredAt"] == "2026-11-18T02:15:00.000Z"

        # El vehículo tiene ambas órdenes (con cliente y sin cliente), ordenadas por createdAt DESC
        veh_hist = api.get(f"/api/customer/vehicles/{vehicle.id}/history?page=1&page_size=1")
        assert veh_hist.status_code == 200
        veh_body = veh_hist.json()
        assert veh_body["total"] == 2
        assert veh_body["pageSize"] == 1
        assert veh_body["items"][0]["orderId"] == anon_order_id
        assert veh_body["items"][0]["customerId"] is None

        # Filtro por status
        filtered = api.get(f"/api/customer/vehicles/{vehicle.id}/history?status=ENTREGADO")
        assert filtered.status_code == 200
        assert filtered.json()["total"] == 1
        assert filtered.json()["items"][0]["orderId"] == order_id

        # 404 para cliente o vehículo inexistente y 401/403 por seguridad
        assert api.get(f"/api/customer/customers/{MISSING_UUID}/history").status_code == 404
        assert api.get(f"/api/customer/vehicles/{MISSING_UUID}/history").status_code == 404
        assert APIClient().get(f"/api/customer/customers/{customer.id}/history").status_code == 401
        assert (
            _auth_client(role="WASHER")
            .get(f"/api/customer/vehicles/{vehicle.id}/history")
            .status_code
            == 403
        )

    def test_inbox_rolls_back_when_history_upsert_fails(self) -> None:
        class _ExplodingHistoryRepo:
            def find_by_order_id(self, _order_id):
                return None

            def upsert(self, _item) -> None:
                raise RuntimeError("fallo simulado al guardar wash_history")

            def list_by_customer(self, *_args, **_kwargs):
                return [], 0

            def list_by_plate(self, *_args, **_kwargs):
                return [], 0

        use_case = ApplyWashOrderEvent(
            inbox_repository=DjangoInboxRepository(),
            history_repository=_ExplodingHistoryRepo(),
            uow=DjangoUnitOfWork(),
        )
        consumer = build_order_event_consumer()
        consumer._apply_order_event = use_case  # inyección directa del caso de uso que falla

        event_id = str(uuid4())
        raw = _build_order_event(
            evento="WashOrderCreated",
            order_id=str(uuid4()),
            plate="9999-AAA",
            customer_id=None,
            estado="EN_ESPERA",
            event_id=event_id,
        )

        with pytest.raises(RuntimeError, match="fallo simulado"):
            consumer.handle_raw_message(raw, topic="wash-order.order.events")

        # El evento NO debe quedar marcado en inbox_events tras el rollback
        assert InboxEventModel.objects.filter(event_id=event_id).count() == 0
        assert WashHistoryModel.objects.count() == 0
