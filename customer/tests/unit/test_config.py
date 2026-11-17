"""Pruebas iniciales de configuración de Django, entorno y punto de composición."""

from __future__ import annotations

import pytest
from django.apps import apps
from django.conf import settings

from config.container import build_container
from config.env import EXPECTED_DATABASE, load_env_config, parse_database_url


def test_django_loads_expected_settings_without_connecting_to_postgres() -> None:
    """Django debe cargar su configuración apuntando a customer_db y con DRF registrado."""
    assert settings.PORT == 3003
    assert settings.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"
    assert settings.DATABASES["default"]["NAME"] == EXPECTED_DATABASE
    assert apps.is_installed("rest_framework")
    assert apps.is_installed("infrastructure")
    assert apps.is_installed("presentation")
    assert settings.ROOT_URLCONF == "config.urls"
    assert settings.WSGI_APPLICATION == "config.wsgi.application"
    assert settings.ASGI_APPLICATION == "config.asgi.application"


def test_parse_database_url_accepts_customer_db() -> None:
    db = parse_database_url("postgresql://user_test:pass_test@localhost:5432/customer_db")

    assert db["ENGINE"] == "django.db.backends.postgresql"
    assert db["NAME"] == "customer_db"
    assert db["USER"] == "user_test"
    assert db["PASSWORD"] == "pass_test"
    assert db["HOST"] == "localhost"
    assert db["PORT"] == "5432"


@pytest.mark.parametrize(
    "forbidden_db",
    ["catalog_db", "identity_db", "wash_order_db", "postgres"],
)
def test_parse_database_url_rejects_other_service_databases(forbidden_db: str) -> None:
    with pytest.raises(ValueError, match="Base de datos no permitida"):
        parse_database_url(f"postgresql://postgres:secret@localhost:5432/{forbidden_db}")


def test_parse_database_url_rejects_non_postgresql_scheme() -> None:
    with pytest.raises(ValueError, match="postgresql://"):
        parse_database_url("sqlite:///customer.db")


def test_load_env_config_allows_development_without_database_url() -> None:
    config = load_env_config(environ={})

    assert config.app_env == "development"
    assert config.port == 3003
    assert config.database["NAME"] == "customer_db"
    assert config.django_secret_key != ""
    assert config.kafka.brokers == ("localhost:9092",)
    assert config.kafka.client_id == "customer-service"
    assert config.kafka.group_id == "customer-service-group"
    assert config.kafka.order_event_topics == ("wash-order.order.events",)


def test_load_env_config_requires_secrets_and_database_in_production() -> None:
    with pytest.raises(ValueError, match="DJANGO_SECRET_KEY"):
        load_env_config(environ={"APP_ENV": "production"})

    with pytest.raises(ValueError, match="JWT_SECRET"):
        load_env_config(
            environ={
                "APP_ENV": "production",
                "DJANGO_SECRET_KEY": "clave-django-produccion",
                "JWT_SECRET": "muy-corto",
            }
        )

    with pytest.raises(ValueError, match="DATABASE_URL"):
        load_env_config(
            environ={
                "APP_ENV": "production",
                "DJANGO_SECRET_KEY": "clave-django-produccion",
                "JWT_SECRET": "a" * 32,
            }
        )


def test_build_container_exposes_resolved_configuration() -> None:
    config = load_env_config(environ={"PORT": "3003"})
    container = build_container(config=config)

    assert container.config is config
    assert container.config.database["NAME"] == "customer_db"
