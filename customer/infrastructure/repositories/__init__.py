"""Adaptadores de persistencia Django ORM."""

from infrastructure.repositories.customer_repository import DjangoCustomerRepository
from infrastructure.repositories.vehicle_repository import DjangoVehicleRepository
from infrastructure.repositories.wash_history_repository import (
    DjangoWashHistoryRepository,
)

__all__ = [
    "DjangoCustomerRepository",
    "DjangoVehicleRepository",
    "DjangoWashHistoryRepository",
]
