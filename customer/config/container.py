"""Punto de composición inicial (Composition Root) de Customer / Vehicle Service.

En pasos posteriores aquí se ensamblarán repositorios, puertos, casos de uso y adaptadores
sin acoplar las vistas ni los casos de uso a implementaciones concretas.
"""

from __future__ import annotations

from dataclasses import dataclass

from config.env import EnvConfig, load_env_config


@dataclass(frozen=True)
class Container:
    """Contenedor de dependencias del microservicio."""

    config: EnvConfig


def build_container(config: EnvConfig | None = None) -> Container:
    """Construye el contenedor inicial con la configuración resuelta."""
    resolved_config = config if config is not None else load_env_config()
    return Container(config=resolved_config)
