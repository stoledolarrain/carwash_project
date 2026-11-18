"""Contratos (puertos) de persistencia y transacciones de la capa Application."""

from application.ports.customer_repository import CustomerRepository
from application.ports.inbox_repository import InboxRepository
from application.ports.unit_of_work import UnitOfWork
from application.ports.vehicle_repository import VehicleRepository
from application.ports.wash_history_repository import WashHistoryRepository

__all__ = [
    "CustomerRepository",
    "VehicleRepository",
    "UnitOfWork",
    "InboxRepository",
    "WashHistoryRepository",
]
