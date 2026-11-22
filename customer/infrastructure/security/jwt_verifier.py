"""Verificador local de tokens JWT emitidos por Identity Service (HS256)."""

from __future__ import annotations

from dataclasses import dataclass

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from config.env import MIN_JWT_SECRET_LENGTH

JWT_ALGORITHM = "HS256"
VALID_ROLES = frozenset({"ADMIN", "RECEPTIONIST", "WASHER"})


@dataclass(frozen=True)
class AuthenticatedUser:
    """Contexto de usuario autenticado extraído del JWT verificado."""

    user_id: str
    role: str
    token_version: int | None = None

    @property
    def is_authenticated(self) -> bool:
        return True


class JwtAuthenticationError(Exception):
    """Error controlado cuando el token está ausente, vencido o es inválido."""

    code: str = "UNAUTHORIZED"


class JwtConfigurationError(Exception):
    """Error controlado cuando falta configuración JWT obligatoria en el servidor."""

    code: str = "AUTH_MISCONFIGURED"


class JwtVerifier:
    """Valida firma HS256, expiración, issuer, audience y claims del contrato real de Identity."""

    def __init__(self, *, secret: str, issuer: str, audience: str) -> None:
        self._secret = (secret or "").strip()
        self._issuer = (issuer or "").strip()
        self._audience = (audience or "").strip()

    def _ensure_configured(self) -> None:
        if (
            len(self._secret) < MIN_JWT_SECRET_LENGTH
            or not self._issuer
            or not self._audience
        ):
            raise JwtConfigurationError("Configuración de autenticación no disponible.")

    def verify(self, token: str) -> AuthenticatedUser:
        self._ensure_configured()

        if not isinstance(token, str) or not token.strip():
            raise JwtAuthenticationError("El token de acceso es inválido.")

        try:
            header = jwt.get_unverified_header(token)
        except InvalidTokenError as exc:
            raise JwtAuthenticationError("El token de acceso es inválido.") from exc

        if header.get("alg") != JWT_ALGORITHM:
            raise JwtAuthenticationError("El token de acceso es inválido.")

        try:
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=[JWT_ALGORITHM],
                issuer=self._issuer,
                audience=self._audience,
                options={"require": ["exp", "sub", "role", "iss", "aud"]},
            )
        except ExpiredSignatureError as exc:
            raise JwtAuthenticationError(
                "El token de acceso expiró. Inicie sesión nuevamente."
            ) from exc
        except InvalidTokenError as exc:
            raise JwtAuthenticationError("El token de acceso es inválido.") from exc

        sub = payload.get("sub")
        role = payload.get("role")
        tv = payload.get("tv")

        if not isinstance(sub, str) or not sub.strip():
            raise JwtAuthenticationError("El token de acceso es inválido.")

        if not isinstance(role, str) or role not in VALID_ROLES:
            raise JwtAuthenticationError("El token de acceso es inválido.")

        if tv is not None and (isinstance(tv, bool) or not isinstance(tv, int) or tv < 0):
            raise JwtAuthenticationError("El token de acceso es inválido.")

        return AuthenticatedUser(user_id=sub.strip(), role=role, token_version=tv)
