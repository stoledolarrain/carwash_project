"""Contratos (puertos) de persistencia y transacciones de la capa Application."""

from application.ports.customer_repository import CustomerRepository
from application.ports.unit_of_work import UnitOfWork
from application.ports.vehicle_repository import VehicleRepository

__all__ = ["CustomerRepository", "VehicleRepository", "UnitOfWork"]
