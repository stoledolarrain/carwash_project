"""Pruebas unitarias de la entidad raíz Vehicle y sus eventos de dominio."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import pytest

from domain.entities.vehicle import Vehicle
from domain.errors import InvalidPlateError, InvalidVehicleDataError
from domain.events import VehicleRegistered, VehicleUpdated
from domain.value_objects.plate import Plate
from tests.builders import VehicleBuilder

T0 = datetime(2026, 11, 17, 18, 0, 0, tzinfo=timezone.utc)
T1 = datetime(2026, 11, 17, 19, 0, 0, tzinfo=timezone.utc)
T2 = datetime(2026, 11, 17, 20, 0, 0, tzinfo=timezone.utc)
CUSTOMER_A = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
CUSTOMER_B = UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")


class TestVehicleCreationAndRestoration:
    def test_creates_vehicle_without_customer_and_emits_registered_event(self) -> None:
        vehicle = Vehicle.create(
            plate=" 1234-abc ",
            brand="  Toyota ",
            model=" Corolla ",
            color=None,
            now=T0,
        )

        assert isinstance(vehicle.id, UUID)
        assert vehicle.plate == Plate("1234-ABC")
        assert vehicle.brand == "Toyota"
        assert vehicle.model == "Corolla"
        assert vehicle.color == ""
        assert vehicle.customer_id is None
        assert vehicle.created_at == T0
        assert vehicle.updated_at == T0

        events = vehicle.pull_domain_events()
        assert len(events) == 1
        event = events[0]
        assert isinstance(event, VehicleRegistered)
        assert event.event_name == "VehicleRegistered"
        assert isinstance(event.event_id, UUID)
        assert event.aggregate_id == vehicle.id
        assert event.occurred_at == T0
        assert event.plate == "1234-ABC"
        assert event.brand == "Toyota"
        assert event.model == "Corolla"
        assert event.color == ""
        assert event.customer_id is None

    def test_creates_vehicle_with_customer_id(self) -> None:
        vehicle = VehicleBuilder().with_customer_id(str(CUSTOMER_A)).at(T0).build()

        assert vehicle.customer_id == CUSTOMER_A
        event = vehicle.pull_domain_events()[0]
        assert isinstance(event, VehicleRegistered)
        assert event.customer_id == CUSTOMER_A

    def test_plate_is_immutable_after_creation(self) -> None:
        vehicle = VehicleBuilder().with_plate("4821-ABC").build()

        with pytest.raises(AttributeError):
            vehicle.plate = Plate("9999-XYZ")  # type: ignore[misc]

        assert vehicle.plate == Plate("4821-ABC")

    @pytest.mark.parametrize(
        "kwargs",
        [
            {"brand": ""},
            {"brand": "   "},
            {"brand": "b" * 51},
            {"brand": None},
            {"model": ""},
            {"model": "   "},
            {"model": "m" * 51},
            {"model": 123},
            {"color": "c" * 31},
            {"color": 999},
            {"customer_id": "no-es-uuid"},
            {"vehicle_id": "no-es-uuid"},
        ],
    )
    def test_rejects_invalid_vehicle_data(self, kwargs: dict[str, object]) -> None:
        payload: dict[str, object] = {
            "plate": "1234-ABC",
            "brand": "Toyota",
            "model": "Corolla",
            "color": "Gris",
        }
        payload.update(kwargs)

        with pytest.raises(InvalidVehicleDataError) as exc_info:
            Vehicle.create(**payload)  # type: ignore[arg-type]

        assert exc_info.value.code == "INVALID_VEHICLE_DATA"

    def test_rejects_invalid_plate_on_create(self) -> None:
        with pytest.raises(InvalidPlateError):
            Vehicle.create(plate="123", brand="Toyota", model="Corolla")

    def test_restores_vehicle_without_emitting_events(self) -> None:
        vehicle = VehicleBuilder().with_customer_id(CUSTOMER_A).at(T0).restore()

        assert vehicle.id == UUID("22222222-2222-4222-8222-222222222222")
        assert vehicle.plate == Plate("1234-ABC")
        assert vehicle.customer_id == CUSTOMER_A
        assert vehicle.pull_domain_events() == ()


class TestVehicleUpdatesAndAssociation:
    def test_updates_brand_model_and_color_emitting_vehicle_updated(self) -> None:
        vehicle = VehicleBuilder().at(T0).build()
        vehicle.pull_domain_events()

        vehicle.update(brand="  Suzuki ", model=" Swift ", color=" Rojo ", now=T1)

        assert vehicle.brand == "Suzuki"
        assert vehicle.model == "Swift"
        assert vehicle.color == "Rojo"
        assert vehicle.updated_at == T1

        events = vehicle.pull_domain_events()
        assert len(events) == 1
        event = events[0]
        assert isinstance(event, VehicleUpdated)
        assert event.changed_fields == ("brand", "model", "color")
        assert event.plate == "1234-ABC"
        assert event.brand == "Suzuki"
        assert event.model == "Swift"
        assert event.color == "Rojo"

    def test_update_without_real_changes_does_not_emit_event(self) -> None:
        vehicle = VehicleBuilder().at(T0).build()
        vehicle.pull_domain_events()

        vehicle.update(brand=" Toyota ", model="Corolla", color=" Gris ", now=T1)

        assert vehicle.updated_at == T0
        assert vehicle.pull_domain_events() == ()

    def test_update_is_atomic_when_validation_fails(self) -> None:
        vehicle = VehicleBuilder().at(T0).build()
        vehicle.pull_domain_events()

        with pytest.raises(InvalidVehicleDataError):
            vehicle.update(brand="Honda", model="", now=T1)

        assert vehicle.brand == "Toyota"
        assert vehicle.model == "Corolla"
        assert vehicle.updated_at == T0
        assert vehicle.pull_domain_events() == ()

    def test_associates_reassigns_and_disassociates_customer(self) -> None:
        vehicle = VehicleBuilder().at(T0).build()
        vehicle.pull_domain_events()

        # Asociar cliente A
        vehicle.associate_customer(CUSTOMER_A, now=T1)
        assert vehicle.customer_id == CUSTOMER_A
        assert vehicle.updated_at == T1

        # Reasignar directamente a cliente B (máximo un cliente a la vez)
        vehicle.associate_customer(CUSTOMER_B, now=T1)
        assert vehicle.customer_id == CUSTOMER_B

        # Desasociar con None
        vehicle.disassociate_customer(now=T2)
        assert vehicle.customer_id is None
        assert vehicle.updated_at == T2

        events = vehicle.pull_domain_events()
        assert len(events) == 3
        assert all(isinstance(e, VehicleUpdated) and e.changed_fields == ("customer_id",) for e in events)
        assert [e.customer_id for e in events] == [CUSTOMER_A, CUSTOMER_B, None]

    def test_associating_same_customer_or_disassociating_when_none_emits_no_event(self) -> None:
        vehicle = VehicleBuilder().at(T0).build()
        vehicle.pull_domain_events()

        vehicle.associate_customer(None, now=T1)
        assert vehicle.updated_at == T0
        assert vehicle.pull_domain_events() == ()

        vehicle.associate_customer(CUSTOMER_A, now=T1)
        vehicle.pull_domain_events()

        vehicle.associate_customer(str(CUSTOMER_A), now=T2)
        assert vehicle.updated_at == T1
        assert vehicle.pull_domain_events() == ()

    def test_associating_invalid_customer_id_raises_domain_error(self) -> None:
        vehicle = VehicleBuilder().at(T0).build()
        vehicle.pull_domain_events()

        with pytest.raises(InvalidVehicleDataError):
            vehicle.associate_customer("uuid-invalido", now=T1)

        assert vehicle.customer_id is None
        assert vehicle.pull_domain_events() == ()
