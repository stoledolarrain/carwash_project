"""Pruebas unitarias de las Queries (CQRS - solo lectura) de Customer y Vehicle."""

from __future__ import annotations

from uuid import uuid4

import pytest

from application.commands import (
    DeactivateCustomer,
    RegisterCustomer,
    RegisterVehicle,
)
from application.dto import CustomerDto, PageDto, VehicleDto
from application.errors import (
    CustomerNotFoundError,
    InvalidRequestError,
    VehicleNotFoundError,
)
from application.queries import (
    GetCustomerById,
    GetVehicleById,
    GetVehicleByPlate,
    ListVehiclesByCustomer,
    SearchCustomers,
)
from domain.errors import InvalidPlateError
from tests.fakes import (
    FakeUnitOfWork,
    InMemoryCustomerRepository,
    InMemoryVehicleRepository,
)


def _seed_data() -> tuple[
    InMemoryCustomerRepository,
    InMemoryVehicleRepository,
    CustomerDto,
    CustomerDto,
    VehicleDto,
    VehicleDto,
]:
    customer_repo = InMemoryCustomerRepository()
    vehicle_repo = InMemoryVehicleRepository()
    uow = FakeUnitOfWork(customer_repository=customer_repo, vehicle_repository=vehicle_repo)

    reg_customer = RegisterCustomer(customer_repository=customer_repo, uow=uow)
    reg_vehicle = RegisterVehicle(
        vehicle_repository=vehicle_repo,
        customer_repository=customer_repo,
        uow=uow,
    )

    c1 = reg_customer.execute(name="Andrea Rojas", phone="70011111", email="andrea@mail.com")
    c2 = reg_customer.execute(name="Carlos Pérez", phone="70022222", email="carlos@mail.com")
    c3 = reg_customer.execute(name="Ana Morales", phone="70033333")
    DeactivateCustomer(customer_repository=customer_repo, uow=uow).execute(customer_id=c2.id)

    v1 = reg_vehicle.execute(plate="4821-ABC", brand="Toyota", model="Corolla", customer_id=c1.id)
    v2 = reg_vehicle.execute(plate="1234-XYZ", brand="Suzuki", model="Swift", customer_id=c1.id)
    reg_vehicle.execute(plate="9999-ZZZ", brand="Ford", model="Ranger", customer_id=None)

    void = c3
    del void
    return customer_repo, vehicle_repo, c1, c2, v1, v2


class TestCustomerQueries:
    def test_get_customer_by_id_returns_dto_without_mutating_state(self) -> None:
        customer_repo, _, c1, _, _, _ = _seed_data()
        saves_before = customer_repo.save_calls

        result = GetCustomerById(customer_repository=customer_repo).execute(customer_id=str(c1.id))

        assert result == c1
        assert customer_repo.save_calls == saves_before

    def test_get_customer_by_id_raises_for_invalid_uuid_or_missing_customer(self) -> None:
        customer_repo = InMemoryCustomerRepository()
        query = GetCustomerById(customer_repository=customer_repo)

        with pytest.raises(InvalidRequestError):
            query.execute(customer_id="invalido")

        with pytest.raises(CustomerNotFoundError):
            query.execute(customer_id=uuid4())

    def test_search_customers_filters_by_text_status_and_paginates_without_mutations(self) -> None:
        customer_repo, _, _, _, _, _ = _seed_data()
        saves_before = customer_repo.save_calls
        query = SearchCustomers(customer_repository=customer_repo)

        all_page = query.execute(page=1, page_size=2)
        assert isinstance(all_page, PageDto)
        assert all_page.total == 3
        assert all_page.page == 1
        assert all_page.page_size == 2
        assert [c.name for c in all_page.items] == ["Ana Morales", "Andrea Rojas"]

        second_page = query.execute(page=2, page_size=2)
        assert [c.name for c in second_page.items] == ["Carlos Pérez"]

        only_active = query.execute(is_active=True)
        assert only_active.total == 2
        assert all(c.is_active is True for c in only_active.items)

        only_inactive = query.execute(is_active=False)
        assert only_inactive.total == 1
        assert only_inactive.items[0].name == "Carlos Pérez"

        by_name = query.execute(query="  andrea ")
        assert by_name.total == 1
        assert by_name.items[0].name == "Andrea Rojas"

        by_phone = query.execute(query="70033333")
        assert by_phone.total == 1
        assert by_phone.items[0].name == "Ana Morales"

        assert customer_repo.save_calls == saves_before

    @pytest.mark.parametrize(
        "kwargs",
        [
            {"page": 0},
            {"page": True},
            {"page_size": 0},
            {"page_size": 101},
            {"is_active": "true"},
            {"query": 123},
        ],
    )
    def test_search_customers_rejects_invalid_parameters(self, kwargs: dict[str, object]) -> None:
        customer_repo = InMemoryCustomerRepository()
        query = SearchCustomers(customer_repository=customer_repo)

        with pytest.raises(InvalidRequestError):
            query.execute(**kwargs)  # type: ignore[arg-type]


class TestVehicleQueries:
    def test_get_vehicle_by_id_and_by_plate_without_mutating_state(self) -> None:
        _, vehicle_repo, _, _, v1, _ = _seed_data()
        saves_before = vehicle_repo.save_calls

        by_id = GetVehicleById(vehicle_repository=vehicle_repo).execute(vehicle_id=v1.id)
        by_plate = GetVehicleByPlate(vehicle_repository=vehicle_repo).execute(plate="  4821-abc ")

        assert by_id == v1
        assert by_plate == v1
        assert vehicle_repo.save_calls == saves_before

    def test_get_vehicle_errors(self) -> None:
        vehicle_repo = InMemoryVehicleRepository()

        with pytest.raises(InvalidRequestError):
            GetVehicleById(vehicle_repository=vehicle_repo).execute(vehicle_id="bad-uuid")

        with pytest.raises(VehicleNotFoundError):
            GetVehicleById(vehicle_repository=vehicle_repo).execute(vehicle_id=uuid4())

        with pytest.raises(InvalidPlateError):
            GetVehicleByPlate(vehicle_repository=vehicle_repo).execute(plate="12")

        with pytest.raises(VehicleNotFoundError):
            GetVehicleByPlate(vehicle_repository=vehicle_repo).execute(plate="0000-AAA")

    def test_list_vehicles_by_customer_returns_paginated_dtos_and_checks_customer_existence(
        self,
    ) -> None:
        customer_repo, vehicle_repo, c1, c2, _, _ = _seed_data()
        saves_before_c = customer_repo.save_calls
        saves_before_v = vehicle_repo.save_calls
        query = ListVehiclesByCustomer(
            vehicle_repository=vehicle_repo,
            customer_repository=customer_repo,
        )

        page_1 = query.execute(customer_id=c1.id, page=1, page_size=1)
        assert page_1.total == 2
        assert len(page_1.items) == 1
        assert page_1.items[0].plate == "1234-XYZ"

        page_2 = query.execute(customer_id=c1.id, page=2, page_size=1)
        assert [v.plate for v in page_2.items] == ["4821-ABC"]

        empty_inactive_customer = query.execute(customer_id=c2.id)
        assert empty_inactive_customer.total == 0
        assert empty_inactive_customer.items == ()

        with pytest.raises(CustomerNotFoundError):
            query.execute(customer_id=uuid4())

        # Ninguna Query modificó los repositorios
        assert customer_repo.save_calls == saves_before_c
        assert vehicle_repo.save_calls == saves_before_v
