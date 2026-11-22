"""Value Object PhoneNumber: número telefónico normalizado e inmutable."""

from __future__ import annotations

import re
from dataclasses import dataclass

from domain.errors import InvalidPhoneError

MIN_PHONE_DIGITS = 7
MAX_PHONE_DIGITS = 15
_FORMAT_SEPARATORS_RE = re.compile(r"[\s-]+")
_VALID_PHONE_RE = re.compile(rf"^\+?\d{{{MIN_PHONE_DIGITS},{MAX_PHONE_DIGITS}}}$")


@dataclass(frozen=True)
class PhoneNumber:
    """Teléfono obligatorio: elimina espacios y guiones, admite '+' inicial y 7..15 dígitos."""

    value: str

    def __post_init__(self) -> None:
        if not isinstance(self.value, str) or not self.value.strip():
            raise InvalidPhoneError("El teléfono del cliente es obligatorio.")

        normalized = _FORMAT_SEPARATORS_RE.sub("", self.value.strip())

        if not _VALID_PHONE_RE.fullmatch(normalized):
            raise InvalidPhoneError(
                f"El teléfono debe contener entre {MIN_PHONE_DIGITS} y {MAX_PHONE_DIGITS} dígitos "
                "y opcionalmente un signo '+' al inicio."
            )

        object.__setattr__(self, "value", normalized)

    def __str__(self) -> str:
        return self.value
