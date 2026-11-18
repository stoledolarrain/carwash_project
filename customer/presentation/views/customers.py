"""Vistas DRF para el recurso Customer (/api/customer/customers/*)."""

from __future__ import annotations

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from application.validation import UNSET
from config.container import get_container
from presentation.serializers import (
    RegisterCustomerInputSerializer,
    UpdateCustomerInputSerializer,
    parse_customer_search_params,
    parse_pagination_params,
    serialize_customer,
    serialize_page,
    serialize_vehicle,
)


def _validate_empty_action_body(data) -> None:
    if data in (None, "", {}):
        return
    if not isinstance(data, dict) or len(data) > 0:
        raise serializers.ValidationError(
            {"body": ["Esta operación no acepta propiedades en el cuerpo de la petición."]}
        )


class CustomerCollectionView(APIView):
    """POST y GET /api/customer/customers."""

    def post(self, request) -> Response:
        serializer = RegisterCustomerInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        container = get_container()
        dto = container.register_customer.execute(
            name=validated["name"],
            phone=validated["phone"],
            email=validated.get("email"),
        )
        return Response(serialize_customer(dto), status=status.HTTP_201_CREATED)

    def get(self, request) -> Response:
        params = parse_customer_search_params(request.query_params)
        container = get_container()
        page_dto = container.search_customers.execute(**params)
        return Response(
            serialize_page(page_dto, serialize_customer),
            status=status.HTTP_200_OK,
        )


class CustomerDetailView(APIView):
    """GET y PATCH /api/customer/customers/{id}."""

    def get(self, request, customer_id: str) -> Response:
        container = get_container()
        dto = container.get_customer_by_id.execute(customer_id=customer_id)
        return Response(serialize_customer(dto), status=status.HTTP_200_OK)

    def patch(self, request, customer_id: str) -> Response:
        serializer = UpdateCustomerInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        container = get_container()
        dto = container.update_customer.execute(
            customer_id=customer_id,
            name=validated["name"] if "name" in validated else UNSET,
            phone=validated["phone"] if "phone" in validated else UNSET,
            email=validated["email"] if "email" in validated else UNSET,
        )
        return Response(serialize_customer(dto), status=status.HTTP_200_OK)


class CustomerActivateView(APIView):
    """PATCH /api/customer/customers/{id}/activate."""

    def patch(self, request, customer_id: str) -> Response:
        _validate_empty_action_body(request.data)
        container = get_container()
        dto = container.activate_customer.execute(customer_id=customer_id)
        return Response(serialize_customer(dto), status=status.HTTP_200_OK)


class CustomerDeactivateView(APIView):
    """PATCH /api/customer/customers/{id}/deactivate."""

    def patch(self, request, customer_id: str) -> Response:
        _validate_empty_action_body(request.data)
        container = get_container()
        dto = container.deactivate_customer.execute(customer_id=customer_id)
        return Response(serialize_customer(dto), status=status.HTTP_200_OK)


class CustomerVehiclesView(APIView):
    """GET /api/customer/customers/{id}/vehicles."""

    def get(self, request, customer_id: str) -> Response:
        page, page_size = parse_pagination_params(request.query_params)
        container = get_container()
        page_dto = container.list_vehicles_by_customer.execute(
            customer_id=customer_id,
            page=page,
            page_size=page_size,
        )
        return Response(
            serialize_page(page_dto, serialize_vehicle),
            status=status.HTTP_200_OK,
        )
