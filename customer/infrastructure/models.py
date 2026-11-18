"""Modelos Django ORM de persistencia para Customer y Vehicle.

Estos modelos pertenecen exclusivamente a Infrastructure y NO son entidades de dominio:
los repositorios convierten entre estos registros y los agregados de `domain/`.
"""

from __future__ import annotations

from django.db import models
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
