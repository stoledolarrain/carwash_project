"""DTOs inmutables de la capa Application."""

from application.dto.customer_dto import CustomerDto
from application.dto.history_dto import IncomingWashOrderEvent, WashHistoryItemDto
from application.dto.pagination_dto import PageDto
from application.dto.vehicle_dto import VehicleDto

__all__ = [
    "CustomerDto",
    "VehicleDto",
    "PageDto",
    "WashHistoryItemDto",
    "IncomingWashOrderEvent",
]
