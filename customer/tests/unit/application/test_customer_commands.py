"""Pruebas unitarias de los Commands de Customer (sin PostgreSQL ni Django)."""

from __future__ import annotations

from dataclasses import FrozenInstanceError
from uuid import UUID, uuid4

import pytest

from application.commands import (
    ActivateCustomer,
    DeactivateCustomer,
    RegisterCustomer,
    UpdateCustomer,
)
from application.dto import CustomerDto
from application.errors import CustomerNotFoundError, InvalidRequestError
from domain.errors import (
    CustomerAlreadyActiveError,
    CustomerAlreadyInactiveError,
    InvalidEmailError,
    InvalidNameError,
    InvalidPhoneError,
)
from tests.fakes import FakeUnitOfWork, InMemoryCustomerRepository


class TestRegisterCustomer:
    def test_registers_customer_persists_in_uow_and_returns_immutable_dto(self) -> None:
        repo = InMemoryCustomerRepository()
        uow = FakeUnitOfWork(customer_repository=repo)
        command = RegisterCustomer(customer_repository=repo, uow=uow)

        result = command.execute(
            name="  Andrea Rojas ",
            phone="+591 700-12345",
            email=" Andrea@CarWash.BO ",
        )

        assert isinstance(result, CustomerDto)
        assert isinstance(result.id, UUID)
        assert result.name == "Andrea Rojas"
        assert result.phone == "+59170012345"
        assert result.email == "andrea@carwash.bo"
        assert result.is_active is True
        assert uow.commits == 1
        assert uow.rollbacks == 0
        assert repo.exists(result.id) is True

        with pytest.raises(FrozenInstanceError):
            result.name = "Otro"  # type: ignore[misc]

    def test_registers_customer_without_email(self) -> None:
        repo = InMemoryCustomerRepository()
        uow = FakeUnitOfWork(customer_repository=repo)
        result = RegisterCustomer(customer_repository=repo, uow=uow).execute(
            name="Luis Gómez",
            phone="70098765",
        )

        assert result.email is None

    def test_propagates_domain_errors_without_opening_transaction(self) -> None:
        repo = InMemoryCustomerRepository()
        uow = FakeUnitOfWork(customer_repository=repo)
        command = RegisterCustomer(customer_repository=repo, uow=uow)

        with pytest.raises(InvalidNameError):
            command.execute(name="A", phone="70012345")
        with pytest.raises(InvalidPhoneError):
            command.execute(name="Luis", phone="abc")
        with pytest.raises(InvalidEmailError):
            command.execute(name="Luis", phone="70012345", email="malo")

        assert repo.save_calls == 0
        assert uow.commits == 0


class TestUpdateCustomer:
    def test_updates_customer_fields_including_clearing_email(self) -> None:
        repo = InMemoryCustomerRepository()
        uow = FakeUnitOfWork(customer_repository=repo)
        created = RegisterCustomer(customer_repository=repo, uow=uow).execute(
            name="Carlos Pérez",
            phone="70011111",
            email="carlos@mail.com",
        )

        updated = UpdateCustomer(customer_repository=repo, uow=uow).execute(
            customer_id=str(created.id),
            name="Carlos Alberto",
            phone="70022222",
            email=None,
        )

        assert updated.id == created.id
        assert updated.name == "Carlos Alberto"
        assert updated.phone == "70022222"
        assert updated.email is None
        assert repo.save_calls == 2
        assert uow.commits == 2

    def test_allows_editing_inactive_customer_preserving_inactive_status(self) -> None:
        repo = InMemoryCustomerRepository()
        uow = FakeUnitOfWork(customer_repository=repo)
        created = RegisterCustomer(customer_repository=repo, uow=uow).execute(
            name="María López",
            phone="70033333",
        )
        DeactivateCustomer(customer_repository=repo, uow=uow).execute(customer_id=created.id)

        updated = UpdateCustomer(customer_repository=repo, uow=uow).execute(
            customer_id=created.id,
            name="María Elena López",
        )

        assert updated.name == "María Elena López"
        assert updated.is_active is False

    def test_update_without_real_changes_does_not_call_save(self) -> None:
        repo = InMemoryCustomerRepository()
        uow = FakeUnitOfWork(customer_repository=repo)
        created = RegisterCustomer(customer_repository=repo, uow=uow).execute(
            name="Pedro",
            phone="70044444",
            email="pedro@mail.com",
        )
        saves_before = repo.save_calls

        result = UpdateCustomer(customer_repository=repo, uow=uow).execute(
            customer_id=created.id,
            name="  Pedro ",
            phone="700-44444",
            email="PEDRO@MAIL.COM",
        )

        assert result.name == "Pedro"
        assert repo.save_calls == saves_before

    def test_rejects_empty_update_invalid_uuid_and_missing_customer(self) -> None:
        repo = InMemoryCustomerRepository()
        uow = FakeUnitOfWork(customer_repository=repo)
        command = UpdateCustomer(customer_repository=repo, uow=uow)

        with pytest.raises(InvalidRequestError) as exc_empty:
            command.execute(customer_id=uuid4())
        assert exc_empty.value.code == "VALIDATION_ERROR"

        with pytest.raises(InvalidRequestError):
            command.execute(customer_id="no-es-uuid", name="Nuevo")

        with pytest.raises(CustomerNotFoundError) as exc_missing:
            command.execute(customer_id=uuid4(), name="Nuevo")
        assert exc_missing.value.code == "CUSTOMER_NOT_FOUND"
        assert uow.rollbacks == 1


class TestActivateAndDeactivateCustomer:
    def test_deactivates_and_reactivates_customer(self) -> None:
        repo = InMemoryCustomerRepository()
        uow = FakeUnitOfWork(customer_repository=repo)
        created = RegisterCustomer(customer_repository=repo, uow=uow).execute(
            name="Sofía",
            phone="70055555",
        )

        deactivated = DeactivateCustomer(customer_repository=repo, uow=uow).execute(
            customer_id=created.id
        )
        assert deactivated.is_active is False

        activated = ActivateCustomer(customer_repository=repo, uow=uow).execute(
            customer_id=created.id
        )
        assert activated.is_active is True

    def test_respects_domain_errors_on_repeated_activation_or_deactivation(self) -> None:
        repo = InMemoryCustomerRepository()
        uow = FakeUnitOfWork(customer_repository=repo)
        created = RegisterCustomer(customer_repository=repo, uow=uow).execute(
            name="Sofía",
            phone="70055555",
        )

        with pytest.raises(CustomerAlreadyActiveError):
            ActivateCustomer(customer_repository=repo, uow=uow).execute(customer_id=created.id)

        DeactivateCustomer(customer_repository=repo, uow=uow).execute(customer_id=created.id)

        with pytest.raises(CustomerAlreadyInactiveError):
            DeactivateCustomer(customer_repository=repo, uow=uow).execute(customer_id=created.id)

        assert uow.rollbacks == 2

    def test_raises_not_found_for_missing_customer(self) -> None:
        repo = InMemoryCustomerRepository()
        uow = FakeUnitOfWork(customer_repository=repo)

        with pytest.raises(CustomerNotFoundError):
            ActivateCustomer(customer_repository=repo, uow=uow).execute(customer_id=uuid4())

        with pytest.raises(CustomerNotFoundError):
            DeactivateCustomer(customer_repository=repo, uow=uow).execute(customer_id=uuid4())
