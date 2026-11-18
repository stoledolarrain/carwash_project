"""Adaptador Django ORM para el puerto CustomerRepository."""

from __future__ import annotations

from uuid import UUID

from django.db.models import Q
from django.db.models.functions import Lower

from domain.entities.customer import Customer
from infrastructure.models import CustomerModel
from infrastructure.outbox import DjangoOutboxRepository


def _to_domain(record: CustomerModel) -> Customer:
    return Customer.restore(
        id=record.id,
        name=record.name,
        phone=record.phone,
        email=record.email,
        is_active=record.is_active,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


class DjangoCustomerRepository:
    """Persiste y consulta el agregado Customer en PostgreSQL mediante Django ORM."""

    def __init__(self, *, outbox_repository: DjangoOutboxRepository | None = None) -> None:
        self._outbox = (
            outbox_repository if outbox_repository is not None else DjangoOutboxRepository()
        )

    def save(self, customer: Customer) -> None:
        """Inserta o actualiza el cliente y registra sus eventos de dominio en outbox_events."""
        CustomerModel.objects.update_or_create(
            id=customer.id,
            defaults={
                "name": customer.name,
                "phone": customer.phone.value,
                "email": customer.email.value if customer.email is not None else None,
                "is_active": customer.is_active,
                "created_at": customer.created_at,
                "updated_at": customer.updated_at,
            },
        )
        events = customer.pull_domain_events()
        if events:
            self._outbox.save_all(events)

    def find_by_id(self, customer_id: UUID) -> Customer | None:
        record = CustomerModel.objects.filter(id=customer_id).first()
        return _to_domain(record) if record is not None else None

    def exists(self, customer_id: UUID) -> bool:
        return CustomerModel.objects.filter(id=customer_id).exists()

    def search(
        self,
        *,
        query: str | None = None,
        is_active: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Customer], int]:
        queryset = CustomerModel.objects.all()

        if is_active is not None:
            queryset = queryset.filter(is_active=is_active)

        if query is not None:
            queryset = queryset.filter(
                Q(name__icontains=query)
                | Q(phone__icontains=query)
                | Q(email__icontains=query)
            )

        total = queryset.count()
        offset = (page - 1) * page_size
        records = queryset.order_by(Lower("name"), "id")[offset : offset + page_size]

        return [_to_domain(record) for record in records], total
