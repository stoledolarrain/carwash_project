"""Value Object Plate: replica exactamente la normalización de VehiclePlate en Wash Order."""

from __future__ import annotations

from dataclasses import dataclass

from domain.errors import InvalidPlateError

MIN_PLATE_LENGTH = 5
MAX_PLATE_LENGTH = 10


@dataclass(frozen=True)
class Plate:
    """Placa vehicular normalizada (trim, mayúsculas, 5..10 caracteres, conserva guiones)."""

    value: str

    def __post_init__(self) -> None:
        if not isinstance(self.value, str) or not self.value.strip():
            raise InvalidPlateError("La placa del vehículo es obligatoria.")

        normalized = self.value.strip().upper()

        if len(normalized) < MIN_PLATE_LENGTH or len(normalized) > MAX_PLATE_LENGTH:
            raise InvalidPlateError(
                f"La placa del vehículo debe tener entre {MIN_PLATE_LENGTH} y {MAX_PLATE_LENGTH} caracteres."
            )

        object.__setattr__(self, "value", normalized)

    def __str__(self) -> str:
        return self.value
