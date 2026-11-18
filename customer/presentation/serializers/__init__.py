"""Serializers HTTP de la capa Presentation."""

from presentation.serializers.common import (
    parse_pagination_params,
    serialize_page,
)
from presentation.serializers.customer_serializers import (
    RegisterCustomerInputSerializer,
    UpdateCustomerInputSerializer,
    parse_customer_search_params,
    serialize_customer,
)
from presentation.serializers.vehicle_serializers import (
    ChangeVehicleCustomerInputSerializer,
    RegisterVehicleInputSerializer,
    UpdateVehicleInputSerializer,
    serialize_vehicle,
)

__all__ = [
    "parse_pagination_params",
    "serialize_page",
    "RegisterCustomerInputSerializer",
    "UpdateCustomerInputSerializer",
    "parse_customer_search_params",
    "serialize_customer",
    "RegisterVehicleInputSerializer",
    "UpdateVehicleInputSerializer",
    "ChangeVehicleCustomerInputSerializer",
    "serialize_vehicle",
]
