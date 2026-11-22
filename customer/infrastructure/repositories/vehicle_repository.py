"""Adaptador Django ORM para el puerto VehicleRepository."""

from __future__ import annotations

from uuid import UUID

from django.db import IntegrityError

from application.errors import CustomerNotFoundError, DuplicatePlateError
from domain.entities.vehicle import Vehicle
from domain.value_objects.plate import Plate
from infrastructure.models import VehicleModel
from infrastructure.outbox import DjangoOutboxRepository

PG_UNIQUE_VIOLATION = "23505"
PG_FOREIGN_KEY_VIOLATION = "23503"


def _to_domain(record: VehicleModel) -> Vehicle:
    return Vehicle.restore(
        id=record.id,
        plate=record.plate,
        brand=record.brand,
        model=record.model,
        color=record.color,
        customer_id=record.customer_id,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _extract_pg_sqlstate(error: IntegrityError) -> str | None:
    cause = getattr(error, "__cause__", None)
    return getattr(cause, "sqlstate", None) or getattr(cause, "pgcode", None)


class DjangoVehicleRepository:
    """Persiste y consulta el agregado Vehicle en PostgreSQL mediante Django ORM."""

    def __init__(self, *, outbox_repository: DjangoOutboxRepository | None = None) -> None:
        self._outbox = (
            outbox_repository if outbox_repository is not None else DjangoOutboxRepository()
        )

    def save(self, vehicle: Vehicle) -> None:
        """Inserta o actualiza el vehículo y registra sus eventos de dominio en outbox_events."""
        try:
            VehicleModel.objects.update_or_create(
                id=vehicle.id,
                defaults={
                    "plate": vehicle.plate.value,
                    "brand": vehicle.brand,
                    "model": vehicle.model,
                    "color": vehicle.color,
                    "customer_id": vehicle.customer_id,
                    "created_at": vehicle.created_at,
                    "updated_at": vehicle.updated_at,
                },
            )
        except IntegrityError as exc:
            sqlstate = _extract_pg_sqlstate(exc)
            message = str(exc).lower()
            if sqlstate == PG_UNIQUE_VIOLATION or "plate" in message or "unique" in message:
                raise DuplicatePlateError(vehicle.plate.value) from exc
            if sqlstate == PG_FOREIGN_KEY_VIOLATION or "customer_id" in message:
                raise CustomerNotFoundError(str(vehicle.customer_id)) from exc
            raise

        events = vehicle.pull_domain_events()
        if events:
            self._outbox.save_all(events)

    def find_by_id(self, vehicle_id: UUID) -> Vehicle | None:
        record = VehicleModel.objects.filter(id=vehicle_id).first()
        return _to_domain(record) if record is not None else None

    def find_by_plate(self, plate: Plate) -> Vehicle | None:
        record = VehicleModel.objects.filter(plate=plate.value).first()
        return _to_domain(record) if record is not None else None

    def exists_by_plate(self, plate: Plate) -> bool:
        return VehicleModel.objects.filter(plate=plate.value).exists()

    def list_by_customer(
        self,
        customer_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Vehicle], int]:
        queryset = VehicleModel.objects.filter(customer_id=customer_id)
        total = queryset.count()
        offset = (page - 1) * page_size
        records = queryset.order_by("plate", "id")[offset : offset + page_size]

        return [_to_domain(record) for record in records], total
