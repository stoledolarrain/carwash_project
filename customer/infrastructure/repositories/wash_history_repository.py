"""Adaptador Django ORM para la proyección local del historial de lavados."""

from __future__ import annotations

from uuid import UUID

from application.dto.history_dto import WashHistoryItemDto
from domain.value_objects.plate import Plate
from infrastructure.models import WashHistoryModel


def _to_dto(record: WashHistoryModel) -> WashHistoryItemDto:
    services = tuple(str(s) for s in (record.services or []))
    return WashHistoryItemDto(
        order_id=record.order_id,
        plate=record.plate,
        customer_id=record.customer_id,
        services=services,
        total_price=record.total_price,
        responsible_id=record.responsible_id,
        status=record.status,
        created_at=record.created_at,
        delivered_at=record.delivered_at,
        last_event_at=record.last_event_at,
    )


class DjangoWashHistoryRepository:
    """Persiste y consulta la proyección local `wash_history` en customer_db."""

    def find_by_order_id(self, order_id: UUID) -> WashHistoryItemDto | None:
        record = WashHistoryModel.objects.filter(order_id=order_id).first()
        return _to_dto(record) if record is not None else None

    def upsert(self, item: WashHistoryItemDto) -> None:
        WashHistoryModel.objects.update_or_create(
            order_id=item.order_id,
            defaults={
                "plate": item.plate,
                "customer_id": item.customer_id,
                "services": list(item.services),
                "total_price": item.total_price,
                "responsible_id": item.responsible_id,
                "status": item.status,
                "created_at": item.created_at,
                "delivered_at": item.delivered_at,
                "last_event_at": item.last_event_at,
            },
        )

    def list_by_customer(
        self,
        customer_id: UUID,
        *,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[WashHistoryItemDto], int]:
        queryset = WashHistoryModel.objects.filter(customer_id=customer_id)
        if status is not None:
            queryset = queryset.filter(status=status)

        total = queryset.count()
        offset = (page - 1) * page_size
        records = queryset.order_by("-created_at", "order_id")[offset : offset + page_size]
        return [_to_dto(record) for record in records], total

    def list_by_plate(
        self,
        plate: Plate,
        *,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[WashHistoryItemDto], int]:
        queryset = WashHistoryModel.objects.filter(plate=plate.value)
        if status is not None:
            queryset = queryset.filter(status=status)

        total = queryset.count()
        offset = (page - 1) * page_size
        records = queryset.order_by("-created_at", "order_id")[offset : offset + page_size]
        return [_to_dto(record) for record in records], total
