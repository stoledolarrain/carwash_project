"""Manejo uniforme de errores HTTP para Customer / Vehicle Service."""

from __future__ import annotations

import logging
from typing import Any

from django.http import Http404, JsonResponse
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    MethodNotAllowed,
    NotAuthenticated,
    NotFound,
    ParseError,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response

from application.errors import (
    ApplicationError,
    CustomerInactiveError,
    CustomerNotFoundError,
    DuplicatePlateError,
    InvalidRequestError,
    VehicleNotFoundError,
)
from domain.errors import (
    CustomerAlreadyActiveError,
    CustomerAlreadyInactiveError,
    DomainError,
)
from infrastructure.security.jwt_verifier import JwtConfigurationError

logger = logging.getLogger(__name__)


def _error_response(
    *,
    code: str,
    message: str,
    status_code: int,
    details: list[dict[str, str]] | None = None,
) -> Response:
    error_body: dict[str, Any] = {"code": code, "message": message}
    if details:
        error_body["details"] = details
    return Response({"error": error_body}, status=status_code)


def _flatten_drf_errors(detail: Any, prefix: str = "") -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    if isinstance(detail, dict):
        for field, value in detail.items():
            key = f"{prefix}.{field}" if prefix else str(field)
            items.extend(_flatten_drf_errors(value, key))
    elif isinstance(detail, list):
        for entry in detail:
            if isinstance(entry, (dict, list)):
                items.extend(_flatten_drf_errors(entry, prefix))
            else:
                items.append({"field": prefix or "body", "message": str(entry)})
    else:
        items.append({"field": prefix or "body", "message": str(detail)})
    return items


def custom_exception_handler(exc: Exception, context: dict[str, Any]) -> Response:
    """Traduce errores de Domain, Application, Auth y DRF al formato uniforme JSON."""
    if isinstance(exc, (CustomerNotFoundError, VehicleNotFoundError)):
        return _error_response(
            code=exc.code,
            message=exc.message,
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if isinstance(
        exc,
        (
            DuplicatePlateError,
            CustomerInactiveError,
            CustomerAlreadyActiveError,
            CustomerAlreadyInactiveError,
        ),
    ):
        return _error_response(
            code=exc.code,
            message=exc.message,
            status_code=status.HTTP_409_CONFLICT,
        )

    if isinstance(exc, (InvalidRequestError, DomainError, ApplicationError)):
        return _error_response(
            code=exc.code,
            message=exc.message,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, JwtConfigurationError):
        logger.error("Configuración JWT incompleta o inválida en Customer Service.")
        return _error_response(
            code=exc.code,
            message="Configuración de autenticación no disponible.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        message = (
            "Se requiere el encabezado Authorization: Bearer <token>."
            if isinstance(exc, NotAuthenticated)
            else str(exc.detail)
        )
        return _error_response(
            code="UNAUTHORIZED",
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    if isinstance(exc, PermissionDenied):
        return _error_response(
            code="FORBIDDEN",
            message=str(exc.detail),
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if isinstance(exc, ParseError):
        return _error_response(
            code="INVALID_JSON",
            message="El cuerpo de la petición no es un JSON válido.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, ValidationError):
        details = _flatten_drf_errors(exc.detail)
        first_message = details[0]["message"] if details else "Los datos enviados no son válidos."
        return _error_response(
            code="VALIDATION_ERROR",
            message=first_message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )

    if isinstance(exc, (Http404, NotFound)):
        return _error_response(
            code="NOT_FOUND",
            message="Recurso o ruta no encontrada.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if isinstance(exc, MethodNotAllowed):
        return _error_response(
            code="METHOD_NOT_ALLOWED",
            message="Método HTTP no permitido para esta ruta.",
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    if isinstance(exc, APIException):
        return _error_response(
            code="REQUEST_ERROR",
            message=str(exc.detail),
            status_code=exc.status_code,
        )

    logger.exception("Error interno inesperado en Customer Service.")
    return _error_response(
        code="INTERNAL_ERROR",
        message="Error interno del servidor.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def django_not_found_handler(request, exception=None) -> JsonResponse:
    return JsonResponse(
        {
            "error": {
                "code": "NOT_FOUND",
                "message": f"Ruta no encontrada: {request.method} {request.path}",
            }
        },
        status=status.HTTP_404_NOT_FOUND,
    )


def django_server_error_handler(request) -> JsonResponse:
    return JsonResponse(
        {
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Error interno del servidor.",
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
