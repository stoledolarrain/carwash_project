"""Errores de dominio de Customer / Vehicle Service (sin códigos HTTP)."""

from __future__ import annotations

from uuid import UUID


class DomainError(Exception):
    """Error base para las invariantes y reglas de negocio del dominio."""

    code: str = "DOMAIN_ERROR"

    def __init__(self, message: str, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code


class InvalidNameError(DomainError):
    code = "INVALID_NAME"


class InvalidPhoneError(DomainError):
    code = "INVALID_PHONE"


class InvalidEmailError(DomainError):
    code = "INVALID_EMAIL"


class InvalidPlateError(DomainError):
    code = "INVALID_PLATE"


class InvalidVehicleDataError(DomainError):
    code = "INVALID_VEHICLE_DATA"


class InvalidCustomerDataError(DomainError):
    code = "INVALID_CUSTOMER_DATA"


class CustomerAlreadyActiveError(DomainError):
    code = "CUSTOMER_ALREADY_ACTIVE"

    def __init__(self, customer_id: UUID) -> None:
        super().__init__(f"El cliente {customer_id} ya está activo.")


class CustomerAlreadyInactiveError(DomainError):
    code = "CUSTOMER_ALREADY_INACTIVE"

    def __init__(self, customer_id: UUID) -> None:
        super().__init__(f"El cliente {customer_id} ya está inactivo.")
