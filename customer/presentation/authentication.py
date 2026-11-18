"""Autenticación JWT para Django REST Framework compatible con Identity Service."""

from __future__ import annotations

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from infrastructure.security.jwt_verifier import (
    AuthenticatedUser,
    JwtAuthenticationError,
    JwtVerifier,
)


class JwtAuthentication(BaseAuthentication):
    """Extrae y verifica exclusivamente el encabezado `Authorization: Bearer <token>`."""

    keyword = "Bearer"

    def authenticate_header(self, request) -> str:
        # Garantiza que DRF responda 401 Unauthorized (y no 403) cuando falta autenticación.
        return self.keyword

    def authenticate(self, request) -> tuple[AuthenticatedUser, None] | None:
        auth_header = request.META.get("HTTP_AUTHORIZATION")
        if auth_header is None:
            return None

        parts = auth_header.strip().split()
        if len(parts) != 2 or parts[0].lower() != self.keyword.lower():
            raise AuthenticationFailed(
                "Se requiere el encabezado Authorization: Bearer <token>."
            )

        jwt_cfg = settings.JWT_CONFIG
        verifier = JwtVerifier(
            secret=jwt_cfg.secret,
            issuer=jwt_cfg.issuer,
            audience=jwt_cfg.audience,
        )

        try:
            user = verifier.verify(parts[1])
        except JwtAuthenticationError as exc:
            raise AuthenticationFailed(str(exc)) from exc

        return user, None
