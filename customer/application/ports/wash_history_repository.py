"""Puerto de persistencia y consulta para la proyección local del historial de lavados."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from application.dto.history_dto import WashHistoryItemDto
from domain.value_objects.plate import Plate


class WashHistoryRepository(Protocol):
    def find_by_order_id(self, order_id: UUID) -> WashHistoryItemDto | None:
        """Obtiene el registro de historial para una orden o None si no existe."""
        ...

    def upsert(self, item: WashHistoryItemDto) -> None:
        """Crea o actualiza el registro de historial para una orden."""
        ...

    def list_by_customer(
        self,
        customer_id: UUID,
        *,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[WashHistoryItemDto], int]:
        """Lista paginada del historial de un cliente ordenada por fecha descendente."""
        ...

    def list_by_plate(
        self,
        plate: Plate,
        *,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[WashHistoryItemDto], int]:
        """Lista paginada del historial de un vehículo por placa ordenada por fecha descendente."""
        ...
