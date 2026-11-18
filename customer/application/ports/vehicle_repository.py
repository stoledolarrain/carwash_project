"""Puerto de persistencia y consulta para el agregado Vehicle."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from domain.entities.vehicle import Vehicle
from domain.value_objects.plate import Plate


class VehicleRepository(Protocol):
    def save(self, vehicle: Vehicle) -> None:
        """Persiste un vehículo nuevo o actualizado."""
        ...

    def find_by_id(self, vehicle_id: UUID) -> Vehicle | None:
        """Busca un vehículo por su UUID o devuelve None si no existe."""
        ...

    def find_by_plate(self, plate: Plate) -> Vehicle | None:
        """Busca un vehículo por su placa normalizada o devuelve None si no existe."""
        ...

    def exists_by_plate(self, plate: Plate) -> bool:
        """Indica si ya existe un vehículo registrado con la placa normalizada."""
        ...

    def list_by_customer(
        self,
        customer_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Vehicle], int]:
        """Lista paginada de vehículos asociados a un cliente; devuelve (items, total)."""
        ...
