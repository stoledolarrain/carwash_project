"""Permisos por rol basados exclusivamente en el JWT verificado de Identity."""

from __future__ import annotations

from rest_framework.permissions import BasePermission

ALLOWED_CUSTOMER_ROLES = frozenset({"ADMIN", "RECEPTIONIST"})


class CanManageCustomers(BasePermission):
    """Permite gestionar clientes y vehículos a ADMIN y RECEPTIONIST (deniega WASHER)."""

    message = "No tiene permisos suficientes para acceder a este recurso."

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not getattr(user, "is_authenticated", False):
            return False
        return getattr(user, "role", None) in ALLOWED_CUSTOMER_ROLES
