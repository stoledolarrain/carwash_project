"""Enrutamiento raíz de Customer / Vehicle Service."""

from __future__ import annotations

from django.urls import include, path

from presentation.views.health import HealthView

urlpatterns = [
    path("health", HealthView.as_view(), name="health"),
    path("api/customer/", include("presentation.urls")),
]

handler404 = "presentation.exception_handler.django_not_found_handler"
handler500 = "presentation.exception_handler.django_server_error_handler"
