"""Carga y validación de variables de entorno para Customer / Vehicle Service."""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

EXPECTED_DATABASE = "customer_db"
DEFAULT_PORT = 3003
MIN_JWT_SECRET_LENGTH = 32
VALID_PG_SCHEMES = frozenset({"postgres", "postgresql"})

# Carga variables desde customer/.env si existe, sin sobrescribir las del entorno del sistema.
load_dotenv(BASE_DIR / ".env", override=False)


@dataclass(frozen=True)
class JwtConfig:
    secret: str
    issuer: str
    audience: str


@dataclass(frozen=True)
class KafkaConfig:
    brokers: tuple[str, ...]
    client_id: str
    group_id: str
    order_event_topics: tuple[str, ...]
    auto_offset_reset: str


@dataclass(frozen=True)
class OutboxConfig:
    poll_interval_ms: int
    batch_size: int


@dataclass(frozen=True)
class EnvConfig:
    app_env: str
    port: int
    django_secret_key: str
    django_debug: bool
    allowed_hosts: tuple[str, ...]
    database: dict[str, object]
    jwt: JwtConfig
    kafka: KafkaConfig
    outbox: OutboxConfig


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_positive_int(value: str | None, default: int, name: str) -> int:
    if value is None or value.strip() == "":
        return default
    try:
        parsed = int(value.strip())
    except ValueError as exc:
        raise ValueError(f"{name} debe ser un número entero positivo.") from exc
    if parsed <= 0:
        raise ValueError(f"{name} debe ser mayor que cero.")
    return parsed


def _parse_port(value: str | None, default: int = DEFAULT_PORT) -> int:
    port = _parse_positive_int(value, default, "PORT")
    if port >= 65536:
        raise ValueError("PORT debe estar entre 1 y 65535.")
    return port


def _parse_csv(value: str | None, default: tuple[str, ...]) -> tuple[str, ...]:
    if value is None or value.strip() == "":
        return default
    items = tuple(part.strip() for part in value.split(",") if part.strip())
    return items or default


def parse_database_url(database_url: str | None, app_env: str = "development") -> dict[str, object]:
    """Convierte DATABASE_URL en la configuración de Django exigiendo exclusivamente customer_db."""
    raw = (database_url or "").strip()

    if not raw:
        if app_env == "production":
            raise ValueError("DATABASE_URL es obligatoria en producción.")
        # Configuración diferida sin credenciales fijas: Django no se conecta hasta ejecutar una consulta.
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": EXPECTED_DATABASE,
            "USER": "",
            "PASSWORD": "",
            "HOST": "localhost",
            "PORT": "5432",
            "CONN_MAX_AGE": 60,
        }

    parsed = urlparse(raw)
    if parsed.scheme not in VALID_PG_SCHEMES:
        raise ValueError(
            f"DATABASE_URL debe usar esquema postgresql:// o postgres:// (recibido: '{parsed.scheme}')."
        )

    db_name = unquote(parsed.path.lstrip("/"))
    if not db_name:
        raise ValueError("DATABASE_URL debe incluir el nombre de la base de datos.")

    if db_name != EXPECTED_DATABASE:
        raise ValueError(
            f"Base de datos no permitida: '{db_name}'. "
            f"Customer Service solo puede utilizar '{EXPECTED_DATABASE}'."
        )

    if not parsed.hostname:
        raise ValueError("DATABASE_URL debe incluir un host válido.")

    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": db_name,
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname,
        "PORT": str(parsed.port or 5432),
        "CONN_MAX_AGE": 60,
    }


def load_env_config(environ: Mapping[str, str] | None = None) -> EnvConfig:
    """Lee y valida las variables de entorno del servicio sin iniciar conexiones de red."""
    env = os.environ if environ is None else environ
    app_env = (env.get("APP_ENV") or "development").strip().lower()
    is_prod = app_env == "production"

    django_secret_key = (env.get("DJANGO_SECRET_KEY") or "").strip()
    if not django_secret_key:
        if is_prod:
            raise ValueError("DJANGO_SECRET_KEY es obligatoria en producción.")
        # Clave efímera en memoria solo para desarrollo/pruebas sin archivo .env.
        django_secret_key = secrets.token_urlsafe(48)

    jwt_secret = (env.get("JWT_SECRET") or "").strip()
    if is_prod and len(jwt_secret) < MIN_JWT_SECRET_LENGTH:
        raise ValueError(
            f"JWT_SECRET es obligatorio en producción y debe tener al menos {MIN_JWT_SECRET_LENGTH} caracteres."
        )

    django_debug = _parse_bool(env.get("DJANGO_DEBUG"), default=not is_prod)
    allowed_hosts = _parse_csv(env.get("ALLOWED_HOSTS"), default=("localhost", "127.0.0.1"))
    database = parse_database_url(env.get("DATABASE_URL"), app_env=app_env)

    auto_offset_reset = (env.get("KAFKA_AUTO_OFFSET_RESET") or "earliest").strip().lower()
    if auto_offset_reset not in {"earliest", "latest"}:
        raise ValueError("KAFKA_AUTO_OFFSET_RESET debe ser 'earliest' o 'latest'.")

    return EnvConfig(
        app_env=app_env,
        port=_parse_port(env.get("PORT"), DEFAULT_PORT),
        django_secret_key=django_secret_key,
        django_debug=django_debug,
        allowed_hosts=allowed_hosts,
        database=database,
        jwt=JwtConfig(
            secret=jwt_secret,
            issuer=(env.get("JWT_ISSUER") or "carwash-identity").strip(),
            audience=(env.get("JWT_AUDIENCE") or "carwash-platform").strip(),
        ),
        kafka=KafkaConfig(
            brokers=_parse_csv(env.get("KAFKA_BROKERS"), default=("localhost:9092",)),
            client_id=(env.get("KAFKA_CLIENT_ID") or "customer-service").strip(),
            group_id=(env.get("KAFKA_GROUP_ID") or "customer-service-group").strip(),
            order_event_topics=_parse_csv(
                env.get("KAFKA_ORDER_EVENT_TOPICS"),
                default=("wash-order.order.events",),
            ),
            auto_offset_reset=auto_offset_reset,
        ),
        outbox=OutboxConfig(
            poll_interval_ms=_parse_positive_int(
                env.get("OUTBOX_POLL_INTERVAL_MS"), 5000, "OUTBOX_POLL_INTERVAL_MS"
            ),
            batch_size=_parse_positive_int(
                env.get("OUTBOX_BATCH_SIZE"), 50, "OUTBOX_BATCH_SIZE"
            ),
        ),
    )
