"""Pruebas unitarias de los Commands de Vehicle (sin PostgreSQL ni Django)."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from application.commands import (
    ChangeVehicleCustomer,
    DeactivateCustomer,
    RegisterCustomer,
    RegisterVehicle,
    UpdateVehicle,
)
from application.dto import VehicleDto
from application.errors import (
    CustomerInactiveError,
    CustomerNotFoundError,
    DuplicatePlateError,
    InvalidRequestError,
    VehicleNotFoundError,
)
from domain.errors import InvalidPlateError, InvalidVehicleDataError
from tests.fakes import (
    FakeUnitOfWork,
    InMemoryCustomerRepository,
    InMemoryVehicleRepository,
)


def _setup_env() -> tuple[InMemoryCustomerRepository, InMemoryVehicleRepository, FakeUnitOfWork]:
    customer_repo = InMemoryCustomerRepository()
    vehicle_repo = InMemoryVehicleRepository()
    uow = FakeUnitOfWork(customer_repository=customer_repo, vehicle_repository=vehicle_repo)
    return customer_repo, vehicle_repo, uow


class TestRegisterVehicle:
    def test_registers_vehicle_without_customer(self) -> None:
        customer_repo, vehicle_repo, uow = _setup_env()
        command = RegisterVehicle(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        )

        result = command.execute(
            plate=" 1234-abc ",
            brand="Toyota",
            model="Corolla",
            color="Gris",
        )

        assert isinstance(result, VehicleDto)
        assert isinstance(result.id, UUID)
        assert result.plate == "1234-ABC"
        assert result.brand == "Toyota"
        assert result.model == "Corolla"
        assert result.color == "Gris"
        assert result.customer_id is None
        assert uow.commits == 1

    def test_registers_vehicle_associated_with_active_customer(self) -> None:
        customer_repo, vehicle_repo, uow = _setup_env()
        customer = RegisterCustomer(customer_repository=customer_repo, uow=uow).execute(
            name="Carlos",
            phone="70012345",
        )

        result = RegisterVehicle(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        ).execute(
            plate="4821-XYZ",
            brand="Suzuki",
            model="Swift",
            customer_id=customer.id,
        )

        assert result.customer_id == customer.id

    def test_rejects_duplicate_plate_ignoring_case_and_spaces(self) -> None:
        customer_repo, vehicle_repo, uow = _setup_env()
        command = RegisterVehicle(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        )

        command.execute(plate="1234-ABC", brand="Toyota", model="Corolla")

        with pytest.raises(DuplicatePlateError) as exc_info:
            command.execute(plate="  1234-abc ", brand="Honda", model="Civic")

        assert exc_info.value.code == "DUPLICATE_PLATE"
        assert vehicle_repo.save_calls == 1
        assert uow.rollbacks == 1

    def test_rejects_missing_or_inactive_customer_on_register(self) -> None:
        customer_repo, vehicle_repo, uow = _setup_env()
        command = RegisterVehicle(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        )

        with pytest.raises(CustomerNotFoundError) as exc_missing:
            command.execute(
                plate="1111-AAA",
                brand="Ford",
                model="Ranger",
                customer_id=uuid4(),
            )
        assert exc_missing.value.code == "CUSTOMER_NOT_FOUND"

        customer = RegisterCustomer(customer_repository=customer_repo, uow=uow).execute(
            name="Inactivo",
            phone="70011111",
        )
        DeactivateCustomer(customer_repository=customer_repo, uow=uow).execute(
            customer_id=customer.id
        )

        with pytest.raises(CustomerInactiveError) as exc_inactive:
            command.execute(
                plate="2222-BBB",
                brand="Ford",
                model="Ranger",
                customer_id=customer.id,
            )
        assert exc_inactive.value.code == "CUSTOMER_INACTIVE"
        assert vehicle_repo.save_calls == 0

    def test_propagates_domain_validation_errors(self) -> None:
        customer_repo, vehicle_repo, uow = _setup_env()
        command = RegisterVehicle(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        )

        with pytest.raises(InvalidPlateError):
            command.execute(plate="123", brand="Toyota", model="Corolla")

        with pytest.raises(InvalidVehicleDataError):
            command.execute(plate="1234-ABC", brand="", model="Corolla")


class TestUpdateVehicle:
    def test_updates_brand_model_and_color_keeping_plate_unchanged(self) -> None:
        customer_repo, vehicle_repo, uow = _setup_env()
        created = RegisterVehicle(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        ).execute(plate="1234-ABC", brand="Toyota", model="Corolla", color="Gris")

        updated = UpdateVehicle(vehicle_repository=vehicle_repo, uow=uow).execute(
            vehicle_id=created.id,
            brand="Nissan",
            model="Sentra",
            color="Blanco",
        )

        assert updated.id == created.id
        assert updated.plate == "1234-ABC"
        assert updated.brand == "Nissan"
        assert updated.model == "Sentra"
        assert updated.color == "Blanco"
        assert vehicle_repo.save_calls == 2

    def test_update_without_real_changes_skips_save(self) -> None:
        customer_repo, vehicle_repo, uow = _setup_env()
        created = RegisterVehicle(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        ).execute(plate="1234-ABC", brand="Toyota", model="Corolla", color="Gris")
        saves_before = vehicle_repo.save_calls

        UpdateVehicle(vehicle_repository=vehicle_repo, uow=uow).execute(
            vehicle_id=created.id,
            brand=" Toyota ",
            color="Gris",
        )

        assert vehicle_repo.save_calls == saves_before

    def test_rejects_empty_update_or_missing_vehicle(self) -> None:
        _, vehicle_repo, uow = _setup_env()
        command = UpdateVehicle(vehicle_repository=vehicle_repo, uow=uow)

        with pytest.raises(InvalidRequestError):
            command.execute(vehicle_id=uuid4())

        with pytest.raises(VehicleNotFoundError) as exc_info:
            command.execute(vehicle_id=uuid4(), color="Rojo")
        assert exc_info.value.code == "VEHICLE_NOT_FOUND"


class TestChangeVehicleCustomer:
    def test_associates_reassigns_and_disassociates_vehicle_customer(self) -> None:
        customer_repo, vehicle_repo, uow = _setup_env()
        customer_a = RegisterCustomer(customer_repository=customer_repo, uow=uow).execute(
            name="Cliente A", phone="70010001"
        )
        customer_b = RegisterCustomer(customer_repository=customer_repo, uow=uow).execute(
            name="Cliente B", phone="70010002"
        )
        vehicle = RegisterVehicle(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        ).execute(plate="5555-AAA", brand="Kia", model="Rio")

        command = ChangeVehicleCustomer(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        )

        associated = command.execute(vehicle_id=vehicle.id, customer_id=customer_a.id)
        assert associated.customer_id == customer_a.id

        reassigned = command.execute(vehicle_id=vehicle.id, customer_id=customer_b.id)
        assert reassigned.customer_id == customer_b.id

        # Incluso si el dueño actual se desactiva, el vehículo puede desasociarse con None
        DeactivateCustomer(customer_repository=customer_repo, uow=uow).execute(
            customer_id=customer_b.id
        )
        disassociated = command.execute(vehicle_id=vehicle.id, customer_id=None)
        assert disassociated.customer_id is None

    def test_rejects_missing_vehicle_or_missing_or_inactive_customer(self) -> None:
        customer_repo, vehicle_repo, uow = _setup_env()
        inactive_customer = RegisterCustomer(customer_repository=customer_repo, uow=uow).execute(
            name="Inactivo", phone="70010003"
        )
        DeactivateCustomer(customer_repository=customer_repo, uow=uow).execute(
            customer_id=inactive_customer.id
        )
        vehicle = RegisterVehicle(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        ).execute(plate="6666-BBB", brand="Mazda", model="3")

        command = ChangeVehicleCustomer(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
            uow=uow,
        )

        with pytest.raises(VehicleNotFoundError):
            command.execute(vehicle_id=uuid4(), customer_id=None)

        with pytest.raises(CustomerNotFoundError):
            command.execute(vehicle_id=vehicle.id, customer_id=uuid4())

        with pytest.raises(CustomerInactiveError):
            command.execute(vehicle_id=vehicle.id, customer_id=inactive_customer.id)

        # El vehículo sigue sin cliente tras los errores
        assert vehicle_repo.find_by_id(vehicle.id).customer_id is None  # type: ignore[union-attr]
