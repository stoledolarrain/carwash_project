"""Adaptador Django ORM del puerto UnitOfWork."""

from __future__ import annotations

from contextlib import AbstractContextManager

from django.db import transaction


class DjangoUnitOfWork:
    """Implementa UnitOfWork delegando el límite transaccional en django.db.transaction.atomic()."""

    def atomic(self) -> AbstractContextManager[None]:
        return transaction.atomic()
