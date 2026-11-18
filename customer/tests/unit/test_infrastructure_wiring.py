"""Pruebas unitarias de Infrastructure y Container (sin requerir conexión a PostgreSQL)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch
from uuid import UUID

import pytest
from django.db import IntegrityError
from django.db.models import RESTRICT

from application.errors import CustomerNotFoundError, DuplicatePlateError
from config.container import build_container
from domain.entities.customer import Customer
from domain.entities.vehicle import Vehicle
from domain.value_objects.email import Email
from domain.value_objects.phone_number import PhoneNumber
from domain.value_objects.plate import Plate
from infrastructure.models import CustomerModel, VehicleModel
from infrastructure.repositories.customer_repository import (
    DjangoCustomerRepository,
    _to_domain as customer_to_domain,
)
from infrastructure.repositories.vehicle_repository import (
    DjangoVehicleRepository,
    _to_domain as vehicle_to_domain,
)
from infrastructure.unit_of_work import DjangoUnitOfWork

T0 = datetime(2026, 11, 17, 18, 0, 0, tzinfo=timezone.utc)


def test_orm_models_match_expected_schema_constraints() -> None:
    assert CustomerModel._meta.db_table == "customers"
    assert VehicleModel._meta.db_table == "vehicles"

    assert CustomerModel._meta.pk.get_internal_type() == "UUIDField"
    assert VehicleModel._meta.pk.get_internal_type() == "UUIDField"

    plate_field = VehicleModel._meta.get_field("plate")
    assert plate_field.unique is True
    assert plate_field.max_length == 10

    customer_fk = VehicleModel._meta.get_field("customer")
    assert customer_fk.null is True
    assert customer_fk.column == "customer_id"
    assert customer_fk.remote_field.on_delete is RESTRICT


def test_repository_mappers_reconstruct_domain_entities_via_restore_without_events() -> None:
    customer_id = UUID("11111111-1111-4111-8111-111111111111")
    vehicle_id = UUID("22222222-2222-4222-8222-222222222222")

    customer_row = CustomerModel(
        id=customer_id,
        name="Andrea Rojas",
        phone="+59170012345",
        email="andrea@carwash.bo",
        is_active=False,
        created_at=T0,
        updated_at=T0,
    )
    restored_customer = customer_to_domain(customer_row)
    assert isinstance(restored_customer, Customer)
    assert restored_customer.id == customer_id
    assert restored_customer.phone == PhoneNumber("+59170012345")
    assert restored_customer.email == Email("andrea@carwash.bo")
    assert restored_customer.is_active is False
    assert restored_customer.pull_domain_events() == ()

    vehicle_row = VehicleModel(
        id=vehicle_id,
        plate="4821-ABC",
        brand="Toyota",
        model="Corolla",
        color="Gris",
        customer_id=customer_id,
        created_at=T0,
        updated_at=T0,
    )
    restored_vehicle = vehicle_to_domain(vehicle_row)
    assert isinstance(restored_vehicle, Vehicle)
    assert restored_vehicle.id == vehicle_id
    assert restored_vehicle.plate == Plate("4821-ABC")
    assert restored_vehicle.customer_id == customer_id
    assert restored_vehicle.pull_domain_events() == ()


def test_vehicle_repository_translates_unique_and_fk_integrity_errors() -> None:
    repo = DjangoVehicleRepository()
    vehicle = Vehicle.create(
        plate="1234-ABC",
        brand="Toyota",
        model="Corolla",
        customer_id=UUID("11111111-1111-4111-8111-111111111111"),
    )

    unique_cause = type("PgUniqueError", (Exception,), {"sqlstate": "23505"})("duplicate key")
    unique_err = IntegrityError("duplicate key value violates unique constraint vehicles_plate_key")
    unique_err.__cause__ = unique_cause

    with patch.object(VehicleModel.objects, "update_or_create", side_effect=unique_err):
        with pytest.raises(DuplicatePlateError) as exc_dup:
            repo.save(vehicle)
        assert exc_dup.value.code == "DUPLICATE_PLATE"

    fk_cause = type("PgFkError", (Exception,), {"sqlstate": "23503"})("foreign key violation")
    fk_err = IntegrityError("insert or update on table vehicles violates foreign key constraint")
    fk_err.__cause__ = fk_cause

    with patch.object(VehicleModel.objects, "update_or_create", side_effect=fk_err):
        with pytest.raises(CustomerNotFoundError) as exc_fk:
            repo.save(vehicle)
        assert exc_fk.value.code == "CUSTOMER_NOT_FOUND"


def test_build_container_wires_django_infrastructure_implementations() -> None:
    container = build_container()

    assert isinstance(container.customer_repository, DjangoCustomerRepository)
    assert isinstance(container.vehicle_repository, DjangoVehicleRepository)
    assert isinstance(container.uow, DjangoUnitOfWork)
    assert container.register_customer is not None
    assert container.register_vehicle is not None
    assert container.list_vehicles_by_customer is not None
