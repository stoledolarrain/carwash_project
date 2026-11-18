"""Punto de composición (Composition Root) de Customer / Vehicle Service.

Ensambla las implementaciones concretas de Infrastructure (repositorios y UnitOfWork)
con los Commands y Queries de Application sin que Application dependa de Infrastructure.
"""

from __future__ import annotations

from dataclasses import dataclass

from application.commands import (
    ActivateCustomer,
    ChangeVehicleCustomer,
    DeactivateCustomer,
    RegisterCustomer,
    RegisterVehicle,
    UpdateCustomer,
    UpdateVehicle,
)
from application.ports import CustomerRepository, UnitOfWork, VehicleRepository
from application.queries import (
    GetCustomerById,
    GetVehicleById,
    GetVehicleByPlate,
    ListVehiclesByCustomer,
    SearchCustomers,
)
from config.env import EnvConfig, load_env_config
from infrastructure.repositories import (
    DjangoCustomerRepository,
    DjangoVehicleRepository,
)
from infrastructure.unit_of_work import DjangoUnitOfWork


@dataclass(frozen=True)
class Container:
    """Contenedor sencillo de dependencias ensambladas del microservicio."""

    config: EnvConfig
    customer_repository: CustomerRepository
    vehicle_repository: VehicleRepository
    uow: UnitOfWork
    # Commands
    register_customer: RegisterCustomer
    update_customer: UpdateCustomer
    activate_customer: ActivateCustomer
    deactivate_customer: DeactivateCustomer
    register_vehicle: RegisterVehicle
    update_vehicle: UpdateVehicle
    change_vehicle_customer: ChangeVehicleCustomer
    # Queries
    get_customer_by_id: GetCustomerById
    search_customers: SearchCustomers
    get_vehicle_by_id: GetVehicleById
    get_vehicle_by_plate: GetVehicleByPlate
    list_vehicles_by_customer: ListVehiclesByCustomer


def build_container(
    *,
    config: EnvConfig | None = None,
    customer_repository: CustomerRepository | None = None,
    vehicle_repository: VehicleRepository | None = None,
    uow: UnitOfWork | None = None,
) -> Container:
    """Construye el contenedor conectando Application con las implementaciones de Infrastructure."""
    resolved_config = config if config is not None else load_env_config()
    resolved_customer_repo = (
        customer_repository if customer_repository is not None else DjangoCustomerRepository()
    )
    resolved_vehicle_repo = (
        vehicle_repository if vehicle_repository is not None else DjangoVehicleRepository()
    )
    resolved_uow = uow if uow is not None else DjangoUnitOfWork()

    return Container(
        config=resolved_config,
        customer_repository=resolved_customer_repo,
        vehicle_repository=resolved_vehicle_repo,
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
    )


_default_container: Container | None = None


def get_container() -> Container:
    """Devuelve el contenedor por defecto ensamblado de forma perezosa."""
    global _default_container
    if _default_container is None:
        _default_container = build_container()
    return _default_container

