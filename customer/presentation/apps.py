"""Configuración de la aplicación Django para la capa Presentation."""

from django.apps import AppConfig


class PresentationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "presentation"
    verbose_name = "Customer Presentation"
