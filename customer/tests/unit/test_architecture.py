"""Pruebas de arquitectura: verifican la regla de dependencia de Clean Architecture."""

from __future__ import annotations

import ast
from pathlib import Path

CUSTOMER_ROOT = Path(__file__).resolve().parents[2]

DOMAIN_FORBIDDEN_ROOTS = frozenset(
    {
        "django",
        "rest_framework",
        "psycopg",
        "confluent_kafka",
        "jwt",
        "dotenv",
        "config",
        "application",
        "infrastructure",
        "presentation",
    }
)

APPLICATION_FORBIDDEN_ROOTS = frozenset(
    {
        "django",
        "rest_framework",
        "psycopg",
        "confluent_kafka",
        "jwt",
        "config",
        "infrastructure",
        "presentation",
    }
)


def _iter_imported_modules(file_path: Path) -> list[str]:
    source = file_path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(file_path))
    modules: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                modules.append(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)

    return modules


def _check_layer_imports(layer_dir: Path, forbidden_roots: frozenset[str]) -> list[str]:
    violations: list[str] = []
    for py_file in sorted(layer_dir.rglob("*.py")):
        for module_name in _iter_imported_modules(py_file):
            root = module_name.split(".")[0]
            if root in forbidden_roots:
                rel = py_file.relative_to(CUSTOMER_ROOT)
                violations.append(f"{rel} importa '{module_name}' (prohibido en {layer_dir.name}/)")
    return violations


def test_expected_layer_directories_exist() -> None:
    expected = [
        CUSTOMER_ROOT / "config",
        CUSTOMER_ROOT / "domain" / "entities",
        CUSTOMER_ROOT / "domain" / "value_objects",
        CUSTOMER_ROOT / "application" / "commands",
        CUSTOMER_ROOT / "application" / "queries",
        CUSTOMER_ROOT / "infrastructure" / "repositories",
        CUSTOMER_ROOT / "infrastructure" / "messaging",
        CUSTOMER_ROOT / "infrastructure" / "security",
        CUSTOMER_ROOT / "infrastructure" / "migrations",
        CUSTOMER_ROOT / "presentation" / "views",
        CUSTOMER_ROOT / "presentation" / "management" / "commands",
        CUSTOMER_ROOT / "tests" / "unit",
        CUSTOMER_ROOT / "tests" / "integration",
    ]
    for path in expected:
        assert path.is_dir(), f"Falta el directorio esperado: {path.relative_to(CUSTOMER_ROOT)}"


def test_domain_has_no_external_or_outer_layer_dependencies() -> None:
    violations = _check_layer_imports(CUSTOMER_ROOT / "domain", DOMAIN_FORBIDDEN_ROOTS)
    assert violations == [], "Violaciones de Clean Architecture en domain/:\n" + "\n".join(violations)


def test_application_depends_only_on_domain_and_stdlib() -> None:
    violations = _check_layer_imports(CUSTOMER_ROOT / "application", APPLICATION_FORBIDDEN_ROOTS)
    assert violations == [], "Violaciones de Clean Architecture en application/:\n" + "\n".join(violations)


def test_presentation_does_not_import_orm_directly() -> None:
    violations: list[str] = []
    presentation_dir = CUSTOMER_ROOT / "presentation"
    forbidden_prefixes = (
        "django.db",
        "infrastructure.models",
        "infrastructure.repositories",
        "confluent_kafka",
    )

    for py_file in sorted(presentation_dir.rglob("*.py")):
        for module_name in _iter_imported_modules(py_file):
            if module_name.startswith(forbidden_prefixes):
                rel = py_file.relative_to(CUSTOMER_ROOT)
                violations.append(f"{rel} importa '{module_name}' directamente desde Presentation")

    assert violations == [], "Presentation no debe acoplarse a ORM ni Kafka:\n" + "\n".join(violations)
