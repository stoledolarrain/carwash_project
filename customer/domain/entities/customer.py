"""Entidad raíz de agregado Customer."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from domain.errors import (
    CustomerAlreadyActiveError,
    CustomerAlreadyInactiveError,
    InvalidCustomerDataError,
    InvalidNameError,
)
from domain.events import (
    CustomerActivated,
    CustomerDeactivated,
    CustomerRegistered,
    CustomerUpdated,
    DomainEvent,
)
from domain.value_objects.email import Email
from domain.value_objects.phone_number import PhoneNumber

MIN_NAME_LENGTH = 2
MAX_NAME_LENGTH = 100
_UNSET: Any = object()


def _utc_now(now: datetime | None = None) -> datetime:
    current = datetime.now(timezone.utc) if now is None else now
    if not isinstance(current, datetime):
        raise InvalidCustomerDataError("La fecha debe ser una instancia de datetime.")
    if current.tzinfo is None:
        return current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _normalize_uuid(value: UUID | str, field_name: str) -> UUID:
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        try:
            return UUID(value)
        except ValueError as exc:
            raise InvalidCustomerDataError(f"El campo '{field_name}' debe ser un UUID válido.") from exc
    raise InvalidCustomerDataError(f"El campo '{field_name}' debe ser un UUID válido.")


def _normalize_name(name: object) -> str:
    if not isinstance(name, str):
        raise InvalidNameError("El nombre del cliente es obligatorio.")
    normalized = name.strip()
    if len(normalized) < MIN_NAME_LENGTH or len(normalized) > MAX_NAME_LENGTH:
        raise InvalidNameError(
            f"El nombre del cliente debe tener entre {MIN_NAME_LENGTH} y {MAX_NAME_LENGTH} caracteres."
        )
    return normalized


def _normalize_phone(phone: PhoneNumber | str) -> PhoneNumber:
    return phone if isinstance(phone, PhoneNumber) else PhoneNumber(phone)


class Customer:
    """Agregado raíz de cliente. Protege sus invariantes y registra eventos ante cambios reales."""

    def __init__(
        self,
        *,
        id: UUID,
        name: str,
        phone: PhoneNumber,
        email: Email | None,
        is_active: bool,
        created_at: datetime,
        updated_at: datetime,
    ) -> None:
        self._id = id
        self._name = name
        self._phone = phone
        self._email = email
        self._is_active = is_active
        self._created_at = created_at
        self._updated_at = updated_at
        self._events: list[DomainEvent] = []

    @classmethod
    def create(
        cls,
        *,
        name: str,
        phone: PhoneNumber | str,
        email: Email | str | None = None,
        customer_id: UUID | str | None = None,
        now: datetime | None = None,
    ) -> Customer:
        """Factory Method: crea un cliente nuevo activo y registra CustomerRegistered."""
        resolved_id = uuid4() if customer_id is None else _normalize_uuid(customer_id, "id")
        timestamp = _utc_now(now)

        customer = cls(
            id=resolved_id,
            name=_normalize_name(name),
            phone=_normalize_phone(phone),
            email=Email.from_optional(email),
            is_active=True,
            created_at=timestamp,
            updated_at=timestamp,
        )
        customer._events.append(
            CustomerRegistered(
                aggregate_id=customer._id,
                occurred_at=timestamp,
                name=customer._name,
                is_active=customer._is_active,
            )
        )
        return customer

    @classmethod
    def restore(
        cls,
        *,
        id: UUID | str,
        name: str,
        phone: PhoneNumber | str,
        email: Email | str | None,
        is_active: bool,
        created_at: datetime,
        updated_at: datetime,
    ) -> Customer:
        """Factory Method: reconstruye un cliente desde persistencia sin registrar eventos."""
        if not isinstance(is_active, bool):
            raise InvalidCustomerDataError("El estado 'is_active' del cliente debe ser booleano.")

        return cls(
            id=_normalize_uuid(id, "id"),
            name=_normalize_name(name),
            phone=_normalize_phone(phone),
            email=Email.from_optional(email),
            is_active=is_active,
            created_at=_utc_now(created_at),
            updated_at=_utc_now(updated_at),
        )

    @property
    def id(self) -> UUID:
        return self._id

    @property
    def name(self) -> str:
        return self._name

    @property
    def phone(self) -> PhoneNumber:
        return self._phone

    @property
    def email(self) -> Email | None:
        return self._email

    @property
    def is_active(self) -> bool:
        return self._is_active

    @property
    def created_at(self) -> datetime:
        return self._created_at

    @property
    def updated_at(self) -> datetime:
        return self._updated_at

    def update(
        self,
        *,
        name: Any = _UNSET,
        phone: Any = _UNSET,
        email: Any = _UNSET,
        now: datetime | None = None,
    ) -> Customer:
        """Actualiza nombre, teléfono y/o correo. Si no hay cambios reales no emite eventos."""
        changed_fields: list[str] = []
        new_name = self._name
        new_phone = self._phone
        new_email = self._email

        if name is not _UNSET:
            new_name = _normalize_name(name)
            if new_name != self._name:
                changed_fields.append("name")

        if phone is not _UNSET:
            new_phone = _normalize_phone(phone)
            if new_phone != self._phone:
                changed_fields.append("phone")

        if email is not _UNSET:
            new_email = Email.from_optional(email)
            if new_email != self._email:
                changed_fields.append("email")

        if not changed_fields:
            return self

        timestamp = _utc_now(now)
        self._name = new_name
        self._phone = new_phone
        self._email = new_email
        self._updated_at = timestamp
        self._events.append(
            CustomerUpdated(
                aggregate_id=self._id,
                occurred_at=timestamp,
                name=self._name,
                is_active=self._is_active,
                changed_fields=tuple(changed_fields),
            )
        )
        return self

    def activate(self, now: datetime | None = None) -> Customer:
        """Activa un cliente inactivo; rechaza si ya está activo."""
        if self._is_active:
            raise CustomerAlreadyActiveError(self._id)

        timestamp = _utc_now(now)
        self._is_active = True
        self._updated_at = timestamp
        self._events.append(
            CustomerActivated(
                aggregate_id=self._id,
                occurred_at=timestamp,
                name=self._name,
                is_active=True,
            )
        )
        return self

    def deactivate(self, now: datetime | None = None) -> Customer:
        """Desactiva un cliente activo; rechaza si ya está inactivo."""
        if not self._is_active:
            raise CustomerAlreadyInactiveError(self._id)

        timestamp = _utc_now(now)
        self._is_active = False
        self._updated_at = timestamp
        self._events.append(
            CustomerDeactivated(
                aggregate_id=self._id,
                occurred_at=timestamp,
                name=self._name,
                is_active=False,
            )
        )
        return self

    def pull_domain_events(self) -> tuple[DomainEvent, ...]:
        """Devuelve los eventos pendientes en orden y limpia la cola interna."""
        pending = tuple(self._events)
        self._events.clear()
        return pending
