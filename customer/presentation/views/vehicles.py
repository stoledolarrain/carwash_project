"""Vistas DRF para el recurso Vehicle (/api/customer/vehicles/*)."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from application.validation import UNSET
from config.container import get_container
from presentation.serializers import (
    ChangeVehicleCustomerInputSerializer,
    RegisterVehicleInputSerializer,
    UpdateVehicleInputSerializer,
    parse_history_query_params,
    serialize_history_item,
    serialize_page,
    serialize_vehicle,
)


class VehicleCollectionView(APIView):
    """POST /api/customer/vehicles."""

    def post(self, request) -> Response:
        serializer = RegisterVehicleInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        container = get_container()
        dto = container.register_vehicle.execute(
            plate=validated["plate"],
            brand=validated["brand"],
            model=validated["model"],
            color=validated.get("color"),
            customer_id=validated.get("customerId"),
        )
        return Response(serialize_vehicle(dto), status=status.HTTP_201_CREATED)


class VehicleDetailView(APIView):
    """GET y PATCH /api/customer/vehicles/{id}."""

    def get(self, request, vehicle_id: str) -> Response:
        container = get_container()
        dto = container.get_vehicle_by_id.execute(vehicle_id=vehicle_id)
        return Response(serialize_vehicle(dto), status=status.HTTP_200_OK)

    def patch(self, request, vehicle_id: str) -> Response:
        serializer = UpdateVehicleInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        container = get_container()
        dto = container.update_vehicle.execute(
            vehicle_id=vehicle_id,
            brand=validated["brand"] if "brand" in validated else UNSET,
            model=validated["model"] if "model" in validated else UNSET,
            color=validated["color"] if "color" in validated else UNSET,
        )
        return Response(serialize_vehicle(dto), status=status.HTTP_200_OK)


class VehicleByPlateView(APIView):
    """GET /api/customer/vehicles/by-plate/{plate}."""

    def get(self, request, plate: str) -> Response:
        container = get_container()
        dto = container.get_vehicle_by_plate.execute(plate=plate)
        return Response(serialize_vehicle(dto), status=status.HTTP_200_OK)


class VehicleCustomerView(APIView):
    """PATCH /api/customer/vehicles/{id}/customer."""

    def patch(self, request, vehicle_id: str) -> Response:
        serializer = ChangeVehicleCustomerInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        container = get_container()
        dto = container.change_vehicle_customer.execute(
            vehicle_id=vehicle_id,
            customer_id=validated["customerId"],
        )
        return Response(serialize_vehicle(dto), status=status.HTTP_200_OK)


class VehicleHistoryView(APIView):
    """GET /api/customer/vehicles/{id}/history."""

    def get(self, request, vehicle_id: str) -> Response:
        params = parse_history_query_params(request.query_params)
        container = get_container()
        page_dto = container.get_vehicle_history.execute(
            vehicle_id=vehicle_id,
            **params,
        )
        return Response(
            serialize_page(page_dto, serialize_history_item),
            status=status.HTTP_200_OK,
        )
