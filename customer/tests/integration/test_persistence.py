"""Pruebas de integración de persistencia PostgreSQL (customer_db) con Django ORM."""

from __future__ import annotations

from uuid import uuid4

import pytest

from application.errors import (
    CustomerInactiveError,
    CustomerNotFoundError,
    DuplicatePlateError,
)
from config.container import build_container
from domain.entities.customer import Customer
from domain.entities.vehicle import Vehicle
from domain.value_objects.plate import Plate
from infrastructure.models import OutboxEventModel
from infrastructure.repositories import (
    DjangoCustomerRepository,
    DjangoVehicleRepository,
)
from infrastructure.unit_of_work import DjangoUnitOfWork

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.integration]


class TestPostgresCustomerPersistence:
    def test_creates_recovers_updates_activates_and_deactivates_customer(self) -> None:
        container = build_container()

        created = container.register_customer.execute(
            name="  Andrea Rojas ",
            phone="+591 700-12345",
            email="Andrea@CarWash.BO",
        )
        fetched = container.get_customer_by_id.execute(customer_id=created.id)
        assert fetched == created

        updated = container.update_customer.execute(
            customer_id=created.id,
            name="Andrea Rojas Paz",
            phone="70099999",
            email=None,
        )
        assert updated.name == "Andrea Rojas Paz"
        assert updated.phone == "70099999"
        assert updated.email is None

        deactivated = container.deactivate_customer.execute(customer_id=created.id)
        assert deactivated.is_active is False

        activated = container.activate_customer.execute(customer_id=created.id)
        assert activated.is_active is True

    def test_searches_and_paginates_customers(self) -> None:
        container = build_container()

        c1 = container.register_customer.execute(name="Carlos Pérez", phone="70011111")
        c2 = container.register_customer.execute(name="Ana Morales", phone="70022222")
        container.register_customer.execute(name="Beatriz Cruz", phone="70033333")
        container.deactivate_customer.execute(customer_id=c1.id)

        page = container.search_customers.execute(is_active=True, page=1, page_size=1)
        assert page.total == 2
        assert [item.id for item in page.items] == [c2.id]

        found = container.search_customers.execute(query="carlos")
        assert found.total == 1
        assert found.items[0].id == c1.id


class TestPostgresVehiclePersistence:
    def test_registers_recovers_updates_and_searches_vehicle_by_plate(self) -> None:
        container = build_container()

        created = container.register_vehicle.execute(
            plate=" 4821-abc ",
            brand="Toyota",
            model="Corolla",
            color="Gris",
            customer_id=None,
        )
        assert created.plate == "4821-ABC"
        assert created.customer_id is None

        by_id = container.get_vehicle_by_id.execute(vehicle_id=created.id)
        by_plate = container.get_vehicle_by_plate.execute(plate="4821-abc")
        assert by_id == created
        assert by_plate == created

        updated = container.update_vehicle.execute(
            vehicle_id=created.id,
            brand="Suzuki",
            model="Swift",
            color="Azul",
        )
        assert updated.plate == "4821-ABC"
        assert updated.brand == "Suzuki"
        assert updated.model == "Swift"
        assert updated.color == "Azul"

    def test_rejects_duplicate_plate_at_application_and_database_unique_constraint(self) -> None:
        container = build_container()
        container.register_vehicle.execute(plate="1234-ABC", brand="Toyota", model="Yaris")

        with pytest.raises(DuplicatePlateError):
            container.register_vehicle.execute(plate=" 1234-abc ", brand="Honda", model="Civic")

        # Verificación directa contra la restricción UNIQUE de PostgreSQL saltando exists_by_plate()
        direct_repo = DjangoVehicleRepository()
        duplicate_entity = Vehicle.create(plate="1234-ABC", brand="Kia", model="Rio")
        with pytest.raises(DuplicatePlateError):
            direct_repo.save(duplicate_entity)

    def test_associates_lists_and_disassociates_vehicles_for_customer(self) -> None:
        container = build_container()
        customer = container.register_customer.execute(name="Luis Gómez", phone="70044444")

        v1 = container.register_vehicle.execute(
            plate="9001-BBB", brand="Ford", model="Ranger", customer_id=customer.id
        )
        v2 = container.register_vehicle.execute(
            plate="1001-AAA", brand="Mazda", model="3", customer_id=None
        )
        container.change_vehicle_customer.execute(vehicle_id=v2.id, customer_id=customer.id)

        listed = container.list_vehicles_by_customer.execute(
            customer_id=customer.id, page=1, page_size=10
        )
        assert listed.total == 2
        assert [v.plate for v in listed.items] == ["1001-AAA", "9001-BBB"]

        disassociated = container.change_vehicle_customer.execute(
            vehicle_id=v1.id, customer_id=None
        )
        assert disassociated.customer_id is None

        # No permite asociar a un cliente inactivo o inexistente
        container.deactivate_customer.execute(customer_id=customer.id)
        with pytest.raises(CustomerInactiveError):
            container.change_vehicle_customer.execute(vehicle_id=v1.id, customer_id=customer.id)
        with pytest.raises(CustomerNotFoundError):
            container.change_vehicle_customer.execute(vehicle_id=v1.id, customer_id=uuid4())


class TestPostgresRestoreAndTransactions:
    def test_repositories_restore_entities_without_events_and_persist_events_to_outbox(self) -> None:
        customer_repo = DjangoCustomerRepository()
        vehicle_repo = DjangoVehicleRepository()

        customer = Customer.create(name="María", phone="70055555", email="maria@mail.com")
        customer_repo.save(customer)
        # Guardar persiste atómicamente los eventos de dominio en outbox_events
        assert customer.pull_domain_events() == ()
        assert OutboxEventModel.objects.filter(
            aggregate_id=customer.id, event_name="CustomerRegistered"
        ).count() == 1

        restored_customer = customer_repo.find_by_id(customer.id)
        assert restored_customer is not None
        assert restored_customer.pull_domain_events() == ()

        vehicle = Vehicle.create(
            plate="7777-XYZ", brand="Nissan", model="Versa", customer_id=customer.id
        )
        vehicle_repo.save(vehicle)
        assert vehicle.pull_domain_events() == ()
        assert OutboxEventModel.objects.filter(
            aggregate_id=vehicle.id, event_name="VehicleRegistered"
        ).count() == 1

        restored_vehicle = vehicle_repo.find_by_plate(Plate("7777-xyz"))
        assert restored_vehicle is not None
        assert restored_vehicle.pull_domain_events() == ()

    def test_unit_of_work_rolls_back_all_changes_and_outbox_on_exception(self) -> None:
        customer_repo = DjangoCustomerRepository()
        uow = DjangoUnitOfWork()
        customer = Customer.create(name="Debe Revertirse", phone="70066666")

        with pytest.raises(RuntimeError, match="fallo simulado"):
            with uow.atomic():
                customer_repo.save(customer)
                raise RuntimeError("fallo simulado")

        assert customer_repo.find_by_id(customer.id) is None
        assert OutboxEventModel.objects.filter(aggregate_id=customer.id).count() == 0
