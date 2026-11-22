"""Configuración de Django para Customer / Vehicle Service."""

from __future__ import annotations

from config.env import BASE_DIR, load_env_config

ENV_CONFIG = load_env_config()

APP_ENV = ENV_CONFIG.app_env
PORT = ENV_CONFIG.port

SECRET_KEY = ENV_CONFIG.django_secret_key
DEBUG = ENV_CONFIG.django_debug
ALLOWED_HOSTS = list(ENV_CONFIG.allowed_hosts)

# Solo se habilitan las apps estrictamente necesarias (Identity gestiona usuarios y sesiones).
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "rest_framework",
    "infrastructure.apps.InfrastructureConfig",
    "presentation.apps.PresentationConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
APPEND_SLASH = False

# Base de datos exclusiva: customer_db (no se conecta al cargar settings).
DATABASES = {
    "default": dict(ENV_CONFIG.database),
}

# Configuración base de Django REST Framework sin dependencia de django.contrib.auth.
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "presentation.authentication.JwtAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
        "presentation.permissions.CanManageCustomers",
    ],
    "EXCEPTION_HANDLER": "presentation.exception_handler.custom_exception_handler",
    "UNAUTHENTICATED_USER": None,
    "UNAUTHENTICATED_TOKEN": None,
}

# Configuraciones específicas del microservicio (consumidas desde Infrastructure).
JWT_CONFIG = ENV_CONFIG.jwt
KAFKA_CONFIG = ENV_CONFIG.kafka
OUTBOX_CONFIG = ENV_CONFIG.outbox

LANGUAGE_CODE = "es"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
