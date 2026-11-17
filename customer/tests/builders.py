"""Builders de prueba (solo para tests) que reducen repetición al construir agregados."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from domain.entities.customer import Customer
from domain.entities.vehicle import Vehicle

DEFAULT_T0 = datetime(2026, 11, 17, 18, 0, 0, tzinfo=timezone.utc)


class CustomerBuilder:
    """Construye instancias de Customer con valores válidos por defecto para pruebas."""

    def __init__(self) -> None:
        self._id: UUID | str | None = None
        self._name: str = "Carlos Pérez"
        self._phone: str = "+591 700-12345"
        self._email: str | None = "carlos.perez@carwash.bo"
        self._is_active: bool = True
        self._created_at: datetime = DEFAULT_T0
        self._updated_at: datetime = DEFAULT_T0

    def with_id(self, customer_id: UUID | str) -> CustomerBuilder:
        self._id = customer_id
        return self

    def with_name(self, name: str) -> CustomerBuilder:
        self._name = name
        return self

    def with_phone(self, phone: str) -> CustomerBuilder:
        self._phone = phone
        return self

    def with_email(self, email: str | None) -> CustomerBuilder:
        self._email = email
        return self

    def inactive(self) -> CustomerBuilder:
        self._is_active = False
        return self

    def at(self, timestamp: datetime) -> CustomerBuilder:
        self._created_at = timestamp
        self._updated_at = timestamp
        return self

    def build(self) -> Customer:
        customer = Customer.create(
            name=self._name,
            phone=self._phone,
            email=self._email,
            customer_id=self._id,
            now=self._created_at,
        )
        if not self._is_active:
            customer.deactivate(now=self._updated_at)
        return customer

    def restore(self) -> Customer:
        return Customer.restore(
            id=self._id or "11111111-1111-4111-8111-111111111111",
            name=self._name,
            phone=self._phone,
            email=self._email,
            is_active=self._is_active,
            created_at=self._created_at,
            updated_at=self._updated_at,
        )


class VehicleBuilder:
    """Construye instancias de Vehicle con valores válidos por defecto para pruebas."""

    def __init__(self) -> None:
        self._id: UUID | str | None = None
        self._plate: str = "1234-ABC"
        self._brand: str = "Toyota"
        self._model: str = "Corolla"
        self._color: str | None = "Gris"
        self._customer_id: UUID | str | None = None
        self._created_at: datetime = DEFAULT_T0
        self._updated_at: datetime = DEFAULT_T0

    def with_id(self, vehicle_id: UUID | str) -> VehicleBuilder:
        self._id = vehicle_id
        return self

    def with_plate(self, plate: str) -> VehicleBuilder:
        self._plate = plate
        return self

    def with_brand(self, brand: str) -> VehicleBuilder:
        self._brand = brand
        return self

    def with_model(self, model: str) -> VehicleBuilder:
        self._model = model
        return self

    def with_color(self, color: str | None) -> VehicleBuilder:
        self._color = color
        return self

    def with_customer_id(self, customer_id: UUID | str | None) -> VehicleBuilder:
        self._customer_id = customer_id
        return self

    def at(self, timestamp: datetime) -> VehicleBuilder:
        self._created_at = timestamp
        self._updated_at = timestamp
        return self

    def build(self) -> Vehicle:
        return Vehicle.create(
            plate=self._plate,
            brand=self._brand,
            model=self._model,
            color=self._color,
            customer_id=self._customer_id,
            vehicle_id=self._id,
            now=self._created_at,
        )

    def restore(self) -> Vehicle:
        return Vehicle.restore(
            id=self._id or "22222222-2222-4222-8222-222222222222",
            plate=self._plate,
            brand=self._brand,
            model=self._model,
            color=self._color,
            customer_id=self._customer_id,
            created_at=self._created_at,
            updated_at=self._updated_at,
        )
