"""Queries (CQRS - lectura) de la capa Application."""

from application.queries.get_customer_by_id import GetCustomerById
from application.queries.get_vehicle_by_id import GetVehicleById
from application.queries.get_vehicle_by_plate import GetVehicleByPlate
from application.queries.list_vehicles_by_customer import ListVehiclesByCustomer
from application.queries.search_customers import SearchCustomers

__all__ = [
    "GetCustomerById",
    "SearchCustomers",
    "GetVehicleById",
    "GetVehicleByPlate",
    "ListVehiclesByCustomer",
]
