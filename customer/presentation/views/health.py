"""Endpoint de salud del microservicio Customer / Vehicle Service."""

from __future__ import annotations

from datetime import datetime, timezone

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from presentation.serializers.common import format_iso_utc


class HealthView(APIView):
    """GET /health — disponible sin autenticación, sin depender de PostgreSQL ni Kafka."""

    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request) -> Response:
        return Response(
            {
                "status": "ok",
                "service": "customer-service",
                "timestamp": format_iso_utc(datetime.now(timezone.utc)),
            },
            status=status.HTTP_200_OK,
        )
