"""Modelos Django ORM de persistencia para Customer y Vehicle.

Estos modelos pertenecen exclusivamente a Infrastructure y NO son entidades de dominio:
los repositorios convierten entre estos registros y los agregados de `domain/`.
"""

from __future__ import annotations

from decimal import Decimal

from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower


class CustomerModel(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.CharField(max_length=254, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        db_table = "customers"
        indexes = [
            models.Index(Lower("name"), name="idx_customers_name_lower"),
            models.Index(fields=["phone"], name="idx_customers_phone"),
            models.Index(fields=["is_active"], name="idx_customers_is_active"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.id})"


class VehicleModel(models.Model):
    id = models.UUIDField(primary_key=True, editable=False)
    plate = models.CharField(max_length=10, unique=True)
    brand = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    color = models.CharField(max_length=30, blank=True, default="")
    customer = models.ForeignKey(
        CustomerModel,
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="vehicles",
        db_column="customer_id",
    )
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        db_table = "vehicles"

    def __str__(self) -> str:
        return f"{self.plate} ({self.brand} {self.model})"


class InboxEventModel(models.Model):
    """Registro de eventos consumidos para garantizar idempotencia por event_id."""

    event_id = models.UUIDField(primary_key=True, editable=False)
    evento = models.CharField(max_length=100)
    aggregate_id = models.UUIDField()
    topic = models.CharField(max_length=150)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inbox_events"

    def __str__(self) -> str:
        return f"{self.evento} ({self.event_id})"


class OutboxEventModel(models.Model):
    """Eventos de dominio pendientes o publicados hacia Kafka (Transactional Outbox)."""

    id = models.UUIDField(primary_key=True, editable=False)
    event_name = models.CharField(max_length=100)
    aggregate_id = models.UUIDField()
    topic = models.CharField(max_length=150)
    payload = models.JSONField()
    created_at = models.DateTimeField()
    published_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "outbox_events"
        indexes = [
            models.Index(
                fields=["created_at"],
                condition=Q(published_at__isnull=True),
                name="idx_outbox_events_pending",
            ),
            models.Index(fields=["aggregate_id"], name="idx_outbox_events_aggregate"),
        ]

    def __str__(self) -> str:
        return f"{self.event_name} ({self.id})"


class WashHistoryModel(models.Model):
    """Proyección local de órdenes de Wash Order (sin claves foráneas externas)."""

    order_id = models.UUIDField(primary_key=True, editable=False)
    plate = models.CharField(max_length=10)
    customer_id = models.UUIDField(null=True, blank=True)
    services = models.JSONField(default=list)
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    responsible_id = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=12)
    created_at = models.DateTimeField()
    delivered_at = models.DateTimeField(null=True, blank=True)
    last_event_at = models.DateTimeField()

    class Meta:
        db_table = "wash_history"
        indexes = [
            models.Index(
                fields=["customer_id", "-created_at"],
                name="idx_wash_history_customer",
            ),
            models.Index(
                fields=["plate", "-created_at"],
                name="idx_wash_history_plate",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.order_id} ({self.plate} - {self.status})"
