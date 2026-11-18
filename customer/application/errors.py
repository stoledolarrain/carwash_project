"""Errores tipados de la capa Application (sin códigos HTTP)."""

from __future__ import annotations

from uuid import UUID


class ApplicationError(Exception):
    """Error base para errores propios de los casos de uso."""

    code: str = "APPLICATION_ERROR"

    def __init__(self, message: str, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code


class InvalidRequestError(ApplicationError):
    code = "VALIDATION_ERROR"


class CustomerNotFoundError(ApplicationError):
    code = "CUSTOMER_NOT_FOUND"

    def __init__(self, customer_id: UUID | str) -> None:
        super().__init__(f"No se encontró el cliente con ID {customer_id}.")


class VehicleNotFoundError(ApplicationError):
    code = "VEHICLE_NOT_FOUND"

    def __init__(self, identifier: UUID | str) -> None:
        super().__init__(f"No se encontró el vehículo {identifier}.")


class CustomerInactiveError(ApplicationError):
    code = "CUSTOMER_INACTIVE"

    def __init__(self, customer_id: UUID | str) -> None:
        super().__init__(
            f"El cliente {customer_id} está inactivo y no puede asociarse a vehículos."
        )


class DuplicatePlateError(ApplicationError):
    code = "DUPLICATE_PLATE"

    def __init__(self, plate: str) -> None:
        super().__init__(f"Ya existe un vehículo registrado con la placa {plate}.")
