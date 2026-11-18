"""Adaptadores de persistencia Django ORM."""

from infrastructure.repositories.customer_repository import DjangoCustomerRepository
from infrastructure.repositories.vehicle_repository import DjangoVehicleRepository

__all__ = ["DjangoCustomerRepository", "DjangoVehicleRepository"]
