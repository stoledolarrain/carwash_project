"""Punto de composición (Composition Root) de Customer / Vehicle Service.

Ensambla las implementaciones concretas de Infrastructure (repositorios, UnitOfWork,
Inbox, Outbox y mensajería Kafka) con los Commands y Queries de Application.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from application.commands import (
    ActivateCustomer,
    ApplyWashOrderEvent,
    ChangeVehicleCustomer,
    DeactivateCustomer,
    RegisterCustomer,
    RegisterVehicle,
    UpdateCustomer,
    UpdateVehicle,
)
from application.ports import (
    CustomerRepository,
    InboxRepository,
    UnitOfWork,
    VehicleRepository,
    WashHistoryRepository,
)
from application.queries import (
    GetCustomerById,
    GetCustomerHistory,
    GetVehicleById,
    GetVehicleByPlate,
    GetVehicleHistory,
    ListVehiclesByCustomer,
    SearchCustomers,
)
from config.env import EnvConfig, load_env_config
from infrastructure.inbox import DjangoInboxRepository
from infrastructure.messaging.kafka_consumer import OrderEventConsumerService
from infrastructure.messaging.kafka_producer import KafkaOutboxProducer
from infrastructure.messaging.outbox_publisher import OutboxPublisherService
from infrastructure.outbox import DjangoOutboxRepository
from infrastructure.repositories import (
    DjangoCustomerRepository,
    DjangoVehicleRepository,
    DjangoWashHistoryRepository,
)
from infrastructure.unit_of_work import DjangoUnitOfWork


@dataclass(frozen=True)
class Container:
    """Contenedor sencillo de dependencias ensambladas del microservicio."""

    config: EnvConfig
    customer_repository: CustomerRepository
    vehicle_repository: VehicleRepository
    inbox_repository: InboxRepository
    history_repository: WashHistoryRepository
    outbox_repository: DjangoOutboxRepository
    uow: UnitOfWork
    # Commands
    register_customer: RegisterCustomer
    update_customer: UpdateCustomer
    activate_customer: ActivateCustomer
    deactivate_customer: DeactivateCustomer
    register_vehicle: RegisterVehicle
    update_vehicle: UpdateVehicle
    change_vehicle_customer: ChangeVehicleCustomer
    apply_wash_order_event: ApplyWashOrderEvent
    # Queries
    get_customer_by_id: GetCustomerById
    search_customers: SearchCustomers
    get_vehicle_by_id: GetVehicleById
    get_vehicle_by_plate: GetVehicleByPlate
    list_vehicles_by_customer: ListVehiclesByCustomer
    get_customer_history: GetCustomerHistory
    get_vehicle_history: GetVehicleHistory


def build_container(
    *,
    config: EnvConfig | None = None,
    customer_repository: CustomerRepository | None = None,
    vehicle_repository: VehicleRepository | None = None,
    inbox_repository: InboxRepository | None = None,
    history_repository: WashHistoryRepository | None = None,
    outbox_repository: DjangoOutboxRepository | None = None,
    uow: UnitOfWork | None = None,
) -> Container:
    """Construye el contenedor conectando Application con las implementaciones de Infrastructure."""
    resolved_config = config if config is not None else load_env_config()
    resolved_outbox_repo = (
        outbox_repository if outbox_repository is not None else DjangoOutboxRepository()
    )
    resolved_customer_repo = (
        customer_repository
        if customer_repository is not None
        else DjangoCustomerRepository(outbox_repository=resolved_outbox_repo)
    )
    resolved_vehicle_repo = (
        vehicle_repository
        if vehicle_repository is not None
        else DjangoVehicleRepository(outbox_repository=resolved_outbox_repo)
    )
    resolved_inbox_repo = (
        inbox_repository if inbox_repository is not None else DjangoInboxRepository()
    )
    resolved_history_repo = (
        history_repository if history_repository is not None else DjangoWashHistoryRepository()
    )
    resolved_uow = uow if uow is not None else DjangoUnitOfWork()

    return Container(
        config=resolved_config,
        customer_repository=resolved_customer_repo,
        vehicle_repository=resolved_vehicle_repo,
        inbox_repository=resolved_inbox_repo,
        history_repository=resolved_history_repo,
        outbox_repository=resolved_outbox_repo,
        uow=resolved_uow,
        # Commands
        register_customer=RegisterCustomer(
            customer_repository=resolved_customer_repo,
            uow=resolved_uow,
        ),
        update_customer=UpdateCustomer(
            customer_repository=resolved_customer_repo,
            uow=resolved_uow,
        ),
        activate_customer=ActivateCustomer(
            customer_repository=resolved_customer_repo,
            uow=resolved_uow,
        ),
        deactivate_customer=DeactivateCustomer(
            customer_repository=resolved_customer_repo,
            uow=resolved_uow,
        ),
        register_vehicle=RegisterVehicle(
            vehicle_repository=resolved_vehicle_repo,
            customer_repository=resolved_customer_repo,
            uow=resolved_uow,
        ),
        update_vehicle=UpdateVehicle(
            vehicle_repository=resolved_vehicle_repo,
            uow=resolved_uow,
        ),
        change_vehicle_customer=ChangeVehicleCustomer(
            vehicle_repository=resolved_vehicle_repo,
            customer_repository=resolved_customer_repo,
            uow=resolved_uow,
        ),
        apply_wash_order_event=ApplyWashOrderEvent(
            inbox_repository=resolved_inbox_repo,
            history_repository=resolved_history_repo,
            uow=resolved_uow,
        ),
        # Queries
        get_customer_by_id=GetCustomerById(
            customer_repository=resolved_customer_repo,
        ),
        search_customers=SearchCustomers(
            customer_repository=resolved_customer_repo,
        ),
        get_vehicle_by_id=GetVehicleById(
            vehicle_repository=resolved_vehicle_repo,
        ),
        get_vehicle_by_plate=GetVehicleByPlate(
            vehicle_repository=resolved_vehicle_repo,
        ),
        list_vehicles_by_customer=ListVehiclesByCustomer(
            vehicle_repository=resolved_vehicle_repo,
            customer_repository=resolved_customer_repo,
        ),
        get_customer_history=GetCustomerHistory(
            customer_repository=resolved_customer_repo,
            history_repository=resolved_history_repo,
        ),
        get_vehicle_history=GetVehicleHistory(
            vehicle_repository=resolved_vehicle_repo,
            history_repository=resolved_history_repo,
        ),
    )


_default_container: Container | None = None


def get_container() -> Container:
    """Devuelve el contenedor por defecto ensamblado de forma perezosa."""
    global _default_container
    if _default_container is None:
        _default_container = build_container()
    return _default_container


def build_outbox_publisher(
    *,
    container: Container | None = None,
    producer: Any = None,
    batch_size: int | None = None,
    poll_interval_ms: int | None = None,
) -> OutboxPublisherService:
    """Construye el servicio de publicación Outbox -> Kafka usando la configuración actual."""
    resolved = container if container is not None else get_container()
    kafka_producer = KafkaOutboxProducer(
        brokers=resolved.config.kafka.brokers,
        client_id=resolved.config.kafka.client_id,
        producer=producer,
    )
    return OutboxPublisherService(
        outbox_repository=resolved.outbox_repository,
        producer=kafka_producer,
        batch_size=(
            resolved.config.outbox.batch_size if batch_size is None else batch_size
        ),
        poll_interval_ms=(
            resolved.config.outbox.poll_interval_ms
            if poll_interval_ms is None
            else poll_interval_ms
        ),
    )


def build_order_event_consumer(
    *,
    container: Container | None = None,
    consumer: Any = None,
) -> OrderEventConsumerService:
    """Construye el consumidor Kafka suscrito al topic real de eventos de Wash Order."""
    resolved = container if container is not None else get_container()
    return OrderEventConsumerService(
        apply_order_event=resolved.apply_wash_order_event,
        brokers=resolved.config.kafka.brokers,
        client_id=resolved.config.kafka.client_id,
        group_id=resolved.config.kafka.group_id,
        topics=resolved.config.kafka.order_event_topics,
        auto_offset_reset=resolved.config.kafka.auto_offset_reset,
        consumer=consumer,
    )
