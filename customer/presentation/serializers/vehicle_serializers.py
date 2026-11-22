"""Serializers de entrada y salida HTTP para Vehicle."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from application.dto.vehicle_dto import VehicleDto
from presentation.serializers.common import (
    StrictCharField,
    StrictInputSerializer,
    format_iso_utc,
)


class RegisterVehicleInputSerializer(StrictInputSerializer):
    plate = StrictCharField(required=True)
    brand = StrictCharField(required=True)
    model = StrictCharField(required=True)
    color = StrictCharField(required=False, allow_null=True, default=None)
    customerId = serializers.UUIDField(required=False, allow_null=True, default=None)


class UpdateVehicleInputSerializer(StrictInputSerializer):
    brand = StrictCharField(required=False)
    model = StrictCharField(required=False)
    color = StrictCharField(required=False, allow_null=True)


class ChangeVehicleCustomerInputSerializer(StrictInputSerializer):
    customerId = serializers.UUIDField(required=True, allow_null=True)


def serialize_vehicle(dto: VehicleDto) -> dict[str, Any]:
    return {
        "id": str(dto.id),
        "plate": dto.plate,
        "brand": dto.brand,
        "model": dto.model,
        "color": dto.color,
        "customerId": str(dto.customer_id) if dto.customer_id is not None else None,
        "createdAt": format_iso_utc(dto.created_at),
        "updatedAt": format_iso_utc(dto.updated_at),
    }
