"""Pruebas unitarias de la entidad raíz Customer y sus eventos de dominio."""

from __future__ import annotations

from dataclasses import FrozenInstanceError
from datetime import datetime, timezone
from uuid import UUID

import pytest

from domain.entities.customer import Customer
from domain.errors import (
    CustomerAlreadyActiveError,
    CustomerAlreadyInactiveError,
    InvalidCustomerDataError,
    InvalidEmailError,
    InvalidNameError,
    InvalidPhoneError,
)
from domain.events import (
    CustomerActivated,
    CustomerDeactivated,
    CustomerRegistered,
    CustomerUpdated,
)
from domain.value_objects.email import Email
from domain.value_objects.phone_number import PhoneNumber
from tests.builders import CustomerBuilder

T0 = datetime(2026, 11, 17, 18, 0, 0, tzinfo=timezone.utc)
T1 = datetime(2026, 11, 17, 19, 0, 0, tzinfo=timezone.utc)
T2 = datetime(2026, 11, 17, 20, 0, 0, tzinfo=timezone.utc)


class TestCustomerCreationAndRestoration:
    def test_creates_active_customer_normalizing_fields_and_emits_registered_event(self) -> None:
        customer = Customer.create(
            name="  Andrea Rojas  ",
            phone="+591 700-55511",
            email="  Andrea@Correo.COM ",
            now=T0,
        )

        assert isinstance(customer.id, UUID)
        assert customer.name == "Andrea Rojas"
        assert customer.phone == PhoneNumber("+59170055511")
        assert customer.email == Email("andrea@correo.com")
        assert customer.is_active is True
        assert customer.created_at == T0
        assert customer.updated_at == T0

        events = customer.pull_domain_events()
        assert len(events) == 1
        event = events[0]
        assert isinstance(event, CustomerRegistered)
        assert event.event_name == "CustomerRegistered"
        assert isinstance(event.event_id, UUID)
        assert event.aggregate_id == customer.id
        assert event.occurred_at == T0
        assert event.name == "Andrea Rojas"
        assert event.is_active is True
        # No debe exponer teléfono ni correo en el evento
        assert not hasattr(event, "phone")
        assert not hasattr(event, "email")
        # La cola se vacía tras pull_domain_events()
        assert customer.pull_domain_events() == ()

    def test_creates_customer_without_email(self) -> None:
        customer = CustomerBuilder().with_email(None).build()
        assert customer.email is None

        customer_blank = CustomerBuilder().with_email("   ").build()
        assert customer_blank.email is None

    @pytest.mark.parametrize(
        "invalid_name",
        ["", "   ", "A", " a ", "x" * 101, None, 123],
    )
    def test_rejects_invalid_names(self, invalid_name: object) -> None:
        with pytest.raises(InvalidNameError) as exc_info:
            Customer.create(name=invalid_name, phone="70012345")  # type: ignore[arg-type]

        assert exc_info.value.code == "INVALID_NAME"

    def test_rejects_invalid_phone_and_email_on_create(self) -> None:
        with pytest.raises(InvalidPhoneError):
            Customer.create(name="Carlos", phone="abc")

        with pytest.raises(InvalidEmailError):
            Customer.create(name="Carlos", phone="70012345", email="correo-malo")

    def test_restores_customer_without_emitting_events(self) -> None:
        customer = CustomerBuilder().inactive().at(T0).restore()

        assert customer.id == UUID("11111111-1111-4111-8111-111111111111")
        assert customer.is_active is False
        assert customer.pull_domain_events() == ()

    def test_restore_validates_id_and_is_active_type(self) -> None:
        with pytest.raises(InvalidCustomerDataError):
            Customer.restore(
                id="no-es-uuid",
                name="Carlos",
                phone="70012345",
                email=None,
                is_active=True,
                created_at=T0,
                updated_at=T0,
            )

        with pytest.raises(InvalidCustomerDataError):
            Customer.restore(
                id="11111111-1111-4111-8111-111111111111",
                name="Carlos",
                phone="70012345",
                email=None,
                is_active="si",  # type: ignore[arg-type]
                created_at=T0,
                updated_at=T0,
            )


class TestCustomerUpdatesAndStatus:
    def test_updates_fields_and_emits_customer_updated_without_pii(self) -> None:
        customer = CustomerBuilder().at(T0).build()
        customer.pull_domain_events()

        customer.update(
            name="  Carlos Alberto Pérez ",
            phone="711-22334",
            email=None,
            now=T1,
        )

        assert customer.name == "Carlos Alberto Pérez"
        assert customer.phone == PhoneNumber("71122334")
        assert customer.email is None
        assert customer.created_at == T0
        assert customer.updated_at == T1

        events = customer.pull_domain_events()
        assert len(events) == 1
        event = events[0]
        assert isinstance(event, CustomerUpdated)
        assert event.aggregate_id == customer.id
        assert event.occurred_at == T1
        assert event.changed_fields == ("name", "phone", "email")
        assert not hasattr(event, "phone")
        assert not hasattr(event, "email")

    def test_update_without_real_changes_does_not_emit_event_or_change_updated_at(self) -> None:
        customer = CustomerBuilder().at(T0).build()
        customer.pull_domain_events()

        customer.update(
            name="  Carlos Pérez ",
            phone="+59170012345",
            email="CARLOS.PEREZ@CARWASH.BO",
            now=T1,
        )

        assert customer.updated_at == T0
        assert customer.pull_domain_events() == ()

    def test_update_is_atomic_when_a_field_is_invalid(self) -> None:
        customer = CustomerBuilder().at(T0).build()
        customer.pull_domain_events()

        with pytest.raises(InvalidEmailError):
            customer.update(name="Nombre Nuevo", email="invalido", now=T1)

        assert customer.name == "Carlos Pérez"
        assert customer.updated_at == T0
        assert customer.pull_domain_events() == ()

    def test_deactivates_and_reactivates_customer_preserving_data_and_emitting_events(self) -> None:
        customer = CustomerBuilder().at(T0).build()
        customer.pull_domain_events()

        customer.deactivate(now=T1)
        assert customer.is_active is False
        assert customer.name == "Carlos Pérez"
        assert customer.phone == PhoneNumber("+59170012345")
        assert customer.updated_at == T1

        # Un cliente inactivo sigue siendo válido y editable
        customer.update(name="Carlos Inactivo", now=T1)
        assert customer.name == "Carlos Inactivo"
        assert customer.is_active is False

        customer.activate(now=T2)
        assert customer.is_active is True
        assert customer.updated_at == T2

        events = customer.pull_domain_events()
        assert [type(e) for e in events] == [CustomerDeactivated, CustomerUpdated, CustomerActivated]
        assert events[0].is_active is False
        assert events[2].is_active is True

    def test_activating_active_customer_raises_domain_error(self) -> None:
        customer = CustomerBuilder().at(T0).build()
        customer.pull_domain_events()

        with pytest.raises(CustomerAlreadyActiveError) as exc_info:
            customer.activate(now=T1)

        assert exc_info.value.code == "CUSTOMER_ALREADY_ACTIVE"
        assert customer.updated_at == T0
        assert customer.pull_domain_events() == ()

    def test_deactivating_inactive_customer_raises_domain_error(self) -> None:
        customer = CustomerBuilder().inactive().at(T0).restore()

        with pytest.raises(CustomerAlreadyInactiveError) as exc_info:
            customer.deactivate(now=T1)

        assert exc_info.value.code == "CUSTOMER_ALREADY_INACTIVE"
        assert customer.updated_at == T0
        assert customer.pull_domain_events() == ()

    def test_domain_events_are_immutable(self) -> None:
        customer = CustomerBuilder().at(T0).build()
        event = customer.pull_domain_events()[0]

        with pytest.raises(FrozenInstanceError):
            event.name = "Otro"  # type: ignore[misc]
