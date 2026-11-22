"""Dobles de prueba (fakes en memoria) para probar Application sin PostgreSQL ni Django."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator
from uuid import UUID

from domain.entities.customer import Customer
from domain.entities.vehicle import Vehicle
from domain.value_objects.plate import Plate


def _clone_customer(customer: Customer) -> Customer:
    return Customer.restore(
        id=customer.id,
        name=customer.name,
        phone=customer.phone,
        email=customer.email,
        is_active=customer.is_active,
        created_at=customer.created_at,
        updated_at=customer.updated_at,
    )


def _clone_vehicle(vehicle: Vehicle) -> Vehicle:
    return Vehicle.restore(
        id=vehicle.id,
        plate=vehicle.plate,
        brand=vehicle.brand,
        model=vehicle.model,
        color=vehicle.color,
        customer_id=vehicle.customer_id,
        created_at=vehicle.created_at,
        updated_at=vehicle.updated_at,
    )


class InMemoryCustomerRepository:
    """Implementación en memoria de CustomerRepository para pruebas unitarias."""

    def __init__(self) -> None:
        self._storage: dict[UUID, Customer] = {}
        self.save_calls: int = 0

    def snapshot(self) -> dict[UUID, Customer]:
        return {cid: _clone_customer(c) for cid, c in self._storage.items()}

    def restore_snapshot(self, state: dict[UUID, Customer]) -> None:
        self._storage = state

    def save(self, customer: Customer) -> None:
        self.save_calls += 1
        self._storage[customer.id] = _clone_customer(customer)

    def find_by_id(self, customer_id: UUID) -> Customer | None:
        found = self._storage.get(customer_id)
        return _clone_customer(found) if found is not None else None

    def exists(self, customer_id: UUID) -> bool:
        return customer_id in self._storage

    def search(
        self,
        *,
        query: str | None = None,
        is_active: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Customer], int]:
        items = list(self._storage.values())

        if is_active is not None:
            items = [c for c in items if c.is_active is is_active]

        if query is not None:
            needle = query.lower()
            items = [
                c
                for c in items
                if needle in c.name.lower()
                or needle in c.phone.value.lower()
                or (c.email is not None and needle in c.email.value.lower())
            ]

        items.sort(key=lambda c: (c.name.lower(), str(c.id)))
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        return [_clone_customer(c) for c in items[start:end]], total


class InMemoryVehicleRepository:
    """Implementación en memoria de VehicleRepository para pruebas unitarias."""

    def __init__(self) -> None:
        self._storage: dict[UUID, Vehicle] = {}
        self.save_calls: int = 0

    def snapshot(self) -> dict[UUID, Vehicle]:
        return {vid: _clone_vehicle(v) for vid, v in self._storage.items()}

    def restore_snapshot(self, state: dict[UUID, Vehicle]) -> None:
        self._storage = state

    def save(self, vehicle: Vehicle) -> None:
        self.save_calls += 1
        self._storage[vehicle.id] = _clone_vehicle(vehicle)

    def find_by_id(self, vehicle_id: UUID) -> Vehicle | None:
        found = self._storage.get(vehicle_id)
        return _clone_vehicle(found) if found is not None else None

    def find_by_plate(self, plate: Plate) -> Vehicle | None:
        for vehicle in self._storage.values():
            if vehicle.plate == plate:
                return _clone_vehicle(vehicle)
        return None

    def exists_by_plate(self, plate: Plate) -> bool:
        return any(vehicle.plate == plate for vehicle in self._storage.values())

    def list_by_customer(
        self,
        customer_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Vehicle], int]:
        items = [v for v in self._storage.values() if v.customer_id == customer_id]
        items.sort(key=lambda v: (v.plate.value, str(v.id)))
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        return [_clone_vehicle(v) for v in items[start:end]], total


class FakeUnitOfWork:
    """Unidad de trabajo en memoria con soporte de rollback y conteo de transacciones."""

    def __init__(
        self,
        *,
        customer_repository: InMemoryCustomerRepository | None = None,
        vehicle_repository: InMemoryVehicleRepository | None = None,
    ) -> None:
        self._customer_repository = customer_repository
        self._vehicle_repository = vehicle_repository
        self.commits: int = 0
        self.rollbacks: int = 0

    @contextmanager
    def atomic(self) -> Iterator[None]:
        customer_snapshot = (
            self._customer_repository.snapshot() if self._customer_repository is not None else None
        )
        vehicle_snapshot = (
            self._vehicle_repository.snapshot() if self._vehicle_repository is not None else None
        )
        try:
            yield
        except Exception:
            self.rollbacks += 1
            if self._customer_repository is not None and customer_snapshot is not None:
                self._customer_repository.restore_snapshot(customer_snapshot)
            if self._vehicle_repository is not None and vehicle_snapshot is not None:
                self._vehicle_repository.restore_snapshot(vehicle_snapshot)
            raise
        else:
            self.commits += 1
