"""Value Object Email: dirección de correo electrónico normalizada e inmutable."""

from __future__ import annotations

import re
from dataclasses import dataclass

from domain.errors import InvalidEmailError

MAX_EMAIL_LENGTH = 254
_BASIC_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


@dataclass(frozen=True)
class Email:
    """Correo electrónico en minúsculas con validación sintáctica básica (sin verificación externa)."""

    value: str

    def __post_init__(self) -> None:
        if not isinstance(self.value, str) or not self.value.strip():
            raise InvalidEmailError("El correo electrónico no puede estar vacío.")

        normalized = self.value.strip().lower()

        if len(normalized) > MAX_EMAIL_LENGTH or not _BASIC_EMAIL_RE.fullmatch(normalized):
            raise InvalidEmailError("El formato del correo electrónico no es válido.")

        local_part, domain_part = normalized.split("@", 1)
        if (
            local_part.startswith(".")
            or local_part.endswith(".")
            or ".." in normalized
            or domain_part.startswith(".")
            or domain_part.endswith(".")
            or domain_part.startswith("-")
            or domain_part.endswith("-")
        ):
            raise InvalidEmailError("El formato del correo electrónico no es válido.")

        object.__setattr__(self, "value", normalized)

    @classmethod
    def from_optional(cls, value: str | Email | None) -> Email | None:
        """Convierte None o cadena vacía en None; si hay contenido, valida como Email."""
        if value is None:
            return None
        if isinstance(value, cls):
            return value
        if isinstance(value, str) and not value.strip():
            return None
        return cls(value)

    def __str__(self) -> str:
        return self.value
