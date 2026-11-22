"""Pruebas de integración de la capa Presentation (DRF APIClient + JWT + PostgreSQL)."""

from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import jwt
import pytest
from rest_framework.test import APIClient

from config.container import build_container
from config.env import JwtConfig

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.integration]

TEST_JWT_SECRET = "test-jwt-secret-para-pruebas-api-customer-32chars-min"
TEST_JWT_ISSUER = "carwash-identity"
TEST_JWT_AUDIENCE = "carwash-platform"
MISSING_UUID = "99999999-9999-4999-8999-999999999999"


@pytest.fixture(autouse=True)
def _configure_test_jwt(settings) -> None:
    settings.JWT_CONFIG = JwtConfig(
        secret=TEST_JWT_SECRET,
        issuer=TEST_JWT_ISSUER,
        audience=TEST_JWT_AUDIENCE,
    )


def _issue_token(
    *,
    role: str = "ADMIN",
    sub: str | None = None,
    tv: int | None = 1,
    secret: str = TEST_JWT_SECRET,
    issuer: str = TEST_JWT_ISSUER,
    audience: str = TEST_JWT_AUDIENCE,
    expires_delta: timedelta = timedelta(hours=1),
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, object] = {
        "sub": sub or str(uuid4()),
        "role": role,
        "iss": issuer,
        "aud": audience,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": str(uuid4()),
    }
    if tv is not None:
        payload["tv"] = tv
    return jwt.encode(payload, secret, algorithm="HS256")


def _auth_client(*, role: str = "ADMIN") -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {_issue_token(role=role)}")
    return client


def _make_unsigned_none_token(role: str = "ADMIN") -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(
        b"="
    )
    payload = base64.urlsafe_b64encode(
        json.dumps(
            {
                "sub": str(uuid4()),
                "role": role,
                "iss": TEST_JWT_ISSUER,
                "aud": TEST_JWT_AUDIENCE,
                "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
            }
        ).encode()
    ).rstrip(b"=")
    return f"{header.decode()}.{payload.decode()}."


class TestHealthEndpoint:
    def test_health_responds_200_without_authentication(self) -> None:
        client = APIClient()
        response = client.get("/health")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["service"] == "customer-service"
        assert isinstance(body["timestamp"], str)


class TestJwtAuthenticationAndPermissions:
    def test_rejects_missing_token_even_with_spoofed_role_headers(self) -> None:
        client = APIClient()
        response = client.get(
            "/api/customer/customers",
            HTTP_X_USER_ROLE="ADMIN",
            HTTP_X_ROLE="ADMIN",
        )

        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"

    def test_rejects_invalid_signature_malformed_none_alg_and_wrong_claims(self) -> None:
        client = APIClient()

        bad_tokens = [
            "token-malformado",
            _issue_token(secret="otro-secreto-completamente-distinto-32chars"),
            _issue_token(issuer="otro-issuer"),
            _issue_token(audience="otra-audiencia"),
            _issue_token(role="CUSTOMER"),
            _make_unsigned_none_token("ADMIN"),
        ]
        for token in bad_tokens:
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
            res = client.get("/api/customer/customers")
            assert res.status_code == 401
            assert res.json()["error"]["code"] == "UNAUTHORIZED"

        client.credentials(HTTP_AUTHORIZATION="Basic dXNlcjpwYXNz")
        res_basic = client.get("/api/customer/customers")
        assert res_basic.status_code == 401

    def test_rejects_expired_token(self) -> None:
        client = APIClient()
        expired = _issue_token(expires_delta=timedelta(minutes=-5))
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {expired}")

        res = client.get("/api/customer/customers")

        assert res.status_code == 401
        assert res.json()["error"]["code"] == "UNAUTHORIZED"

    def test_rejects_protected_requests_when_jwt_secret_is_missing(self, settings) -> None:
        settings.JWT_CONFIG = JwtConfig(
            secret="",
            issuer=TEST_JWT_ISSUER,
            audience=TEST_JWT_AUDIENCE,
        )
        client = _auth_client(role="ADMIN")

        res = client.get("/api/customer/customers")

        assert res.status_code == 500
        assert res.json()["error"]["code"] == "AUTH_MISCONFIGURED"
        assert TEST_JWT_SECRET not in json.dumps(res.json())

    def test_allows_admin_and_receptionist_and_forbids_washer(self) -> None:
        admin_res = _auth_client(role="ADMIN").get("/api/customer/customers")
        assert admin_res.status_code == 200

        receptionist_res = _auth_client(role="RECEPTIONIST").post(
            "/api/customer/customers",
            {"name": "Andrea Rojas", "phone": "+591 700-12345"},
            format="json",
        )
        assert receptionist_res.status_code == 201

        washer_get = _auth_client(role="WASHER").get("/api/customer/customers")
        assert washer_get.status_code == 403
        assert washer_get.json()["error"]["code"] == "FORBIDDEN"

        washer_post = _auth_client(role="WASHER").post(
            "/api/customer/vehicles",
            {"plate": "1234-ABC", "brand": "Toyota", "model": "Corolla"},
            format="json",
        )
        assert washer_post.status_code == 403
        assert washer_post.json()["error"]["code"] == "FORBIDDEN"


class TestCustomerEndpoints:
    def test_full_customer_crud_activate_deactivate_search_and_vehicles(self) -> None:
        client = _auth_client(role="ADMIN")

        # 1. Crear cliente
        create_res = client.post(
            "/api/customer/customers",
            {
                "name": "  Carlos Pérez  ",
                "phone": "+591 700-11223",
                "email": "Carlos@CarWash.BO",
            },
            format="json",
        )
        assert create_res.status_code == 201
        created = create_res.json()
        assert created["name"] == "Carlos Pérez"
        assert created["phone"] == "+59170011223"
        assert created["email"] == "carlos@carwash.bo"
        assert created["isActive"] is True
        assert "createdAt" in created and "updatedAt" in created
        cid = created["id"]

        # 2. Consultar por ID
        get_res = client.get(f"/api/customer/customers/{cid}")
        assert get_res.status_code == 200
        assert get_res.json() == created

        # 3. Actualizar (incluyendo limpiar email con null)
        patch_res = client.patch(
            f"/api/customer/customers/{cid}",
            {"name": "Carlos Alberto Pérez", "email": None},
            format="json",
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["name"] == "Carlos Alberto Pérez"
        assert patch_res.json()["email"] is None

        # 4. Activar cuando ya está activo -> 409
        already_active = client.patch(f"/api/customer/customers/{cid}/activate", {}, format="json")
        assert already_active.status_code == 409
        assert already_active.json()["error"]["code"] == "CUSTOMER_ALREADY_ACTIVE"

        # 5. Desactivar -> 200; repetir -> 409
        deact = client.patch(f"/api/customer/customers/{cid}/deactivate", {}, format="json")
        assert deact.status_code == 200
        assert deact.json()["isActive"] is False

        already_inactive = client.patch(
            f"/api/customer/customers/{cid}/deactivate", {}, format="json"
        )
        assert already_inactive.status_code == 409
        assert already_inactive.json()["error"]["code"] == "CUSTOMER_ALREADY_INACTIVE"

        # 6. Reactivar -> 200
        act = client.patch(f"/api/customer/customers/{cid}/activate", {}, format="json")
        assert act.status_code == 200
        assert act.json()["isActive"] is True

        # 7. Buscar, filtrar y paginar
        client.post(
            "/api/customer/customers",
            {"name": "Ana Morales", "phone": "70099999"},
            format="json",
        )
        search_res = client.get(
            "/api/customer/customers?query=carlos&is_active=true&page=1&page_size=10"
        )
        assert search_res.status_code == 200
        search_body = search_res.json()
        assert search_body["total"] == 1
        assert search_body["page"] == 1
        assert search_body["pageSize"] == 10
        assert search_body["items"][0]["id"] == cid

        # 8. Listar vehículos del cliente
        v_res = client.post(
            "/api/customer/vehicles",
            {
                "plate": "4821-abc",
                "brand": "Toyota",
                "model": "Corolla",
                "color": "Gris",
                "customerId": cid,
            },
            format="json",
        )
        assert v_res.status_code == 201

        list_v = client.get(f"/api/customer/customers/{cid}/vehicles?page=1&page_size=5")
        assert list_v.status_code == 200
        assert list_v.json()["total"] == 1
        assert list_v.json()["items"][0]["plate"] == "4821-ABC"

    def test_customer_error_cases_not_found_and_validation(self) -> None:
        client = _auth_client(role="ADMIN")

        assert client.get(f"/api/customer/customers/{MISSING_UUID}").status_code == 404
        assert client.get(f"/api/customer/customers/{MISSING_UUID}/vehicles").status_code == 404
        assert client.get("/api/customer/customers/no-es-uuid").status_code == 400

        # Campos desconocidos y tipos incorrectos
        unknown_field = client.post(
            "/api/customer/customers",
            {"name": "Luis", "phone": "70012345", "role": "ADMIN"},
            format="json",
        )
        assert unknown_field.status_code == 400
        assert unknown_field.json()["error"]["code"] == "VALIDATION_ERROR"

        bad_type = client.post(
            "/api/customer/customers",
            {"name": 12345, "phone": "70012345"},
            format="json",
        )
        assert bad_type.status_code == 400

        bad_domain_phone = client.post(
            "/api/customer/customers",
            {"name": "Luis", "phone": "abc"},
            format="json",
        )
        assert bad_domain_phone.status_code == 400
        assert bad_domain_phone.json()["error"]["code"] == "INVALID_PHONE"

        empty_patch = client.patch(f"/api/customer/customers/{MISSING_UUID}", {}, format="json")
        assert empty_patch.status_code == 400


class TestVehicleEndpoints:
    def test_full_vehicle_lifecycle_associate_disassociate_and_errors(self) -> None:
        client = _auth_client(role="RECEPTIONIST")

        c1 = client.post(
            "/api/customer/customers",
            {"name": "Cliente Uno", "phone": "70010001"},
            format="json",
        ).json()
        c2 = client.post(
            "/api/customer/customers",
            {"name": "Cliente Dos", "phone": "70010002"},
            format="json",
        ).json()

        # 1. Registrar vehículo sin cliente
        v_res = client.post(
            "/api/customer/vehicles",
            {"plate": " 1234-abc ", "brand": "Suzuki", "model": "Swift", "color": "Rojo"},
            format="json",
        )
        assert v_res.status_code == 201
        vehicle = v_res.json()
        vid = vehicle["id"]
        assert vehicle["plate"] == "1234-ABC"
        assert vehicle["customerId"] is None

        # 2. Consultar por ID y por placa
        assert client.get(f"/api/customer/vehicles/{vid}").status_code == 200
        by_plate = client.get("/api/customer/vehicles/by-plate/1234-abc")
        assert by_plate.status_code == 200
        assert by_plate.json()["id"] == vid

        # 3. Actualizar marca/modelo/color; rechazar cambio de placa
        upd = client.patch(
            f"/api/customer/vehicles/{vid}",
            {"brand": "Toyota", "model": "Yaris", "color": "Blanco"},
            format="json",
        )
        assert upd.status_code == 200
        assert upd.json()["brand"] == "Toyota"
        assert upd.json()["plate"] == "1234-ABC"

        plate_change = client.patch(
            f"/api/customer/vehicles/{vid}",
            {"plate": "9999-XYZ"},
            format="json",
        )
        assert plate_change.status_code == 400
        assert plate_change.json()["error"]["code"] == "VALIDATION_ERROR"

        # 4. Asociar, reasignar y desasociar con customerId: null
        assoc = client.patch(
            f"/api/customer/vehicles/{vid}/customer",
            {"customerId": c1["id"]},
            format="json",
        )
        assert assoc.status_code == 200
        assert assoc.json()["customerId"] == c1["id"]

        reassign = client.patch(
            f"/api/customer/vehicles/{vid}/customer",
            {"customerId": c2["id"]},
            format="json",
        )
        assert reassign.status_code == 200
        assert reassign.json()["customerId"] == c2["id"]

        disassoc = client.patch(
            f"/api/customer/vehicles/{vid}/customer",
            {"customerId": None},
            format="json",
        )
        assert disassoc.status_code == 200
        assert disassoc.json()["customerId"] is None

        # 5. Rechazar placa duplicada -> 409 DUPLICATE_PLATE
        dup = client.post(
            "/api/customer/vehicles",
            {"plate": "1234-ABC", "brand": "Kia", "model": "Rio"},
            format="json",
        )
        assert dup.status_code == 409
        assert dup.json()["error"]["code"] == "DUPLICATE_PLATE"

        # 6. Rechazar cliente inexistente (404) e inactivo (409)
        missing_cust = client.patch(
            f"/api/customer/vehicles/{vid}/customer",
            {"customerId": MISSING_UUID},
            format="json",
        )
        assert missing_cust.status_code == 404
        assert missing_cust.json()["error"]["code"] == "CUSTOMER_NOT_FOUND"

        client.patch(f"/api/customer/customers/{c1['id']}/deactivate", {}, format="json")
        inactive_cust = client.patch(
            f"/api/customer/vehicles/{vid}/customer",
            {"customerId": c1["id"]},
            format="json",
        )
        assert inactive_cust.status_code == 409
        assert inactive_cust.json()["error"]["code"] == "CUSTOMER_INACTIVE"

        # 7. Búsquedas de placa inexistente / inválida
        assert client.get("/api/customer/vehicles/by-plate/0000-ZZZ").status_code == 404
        bad_plate = client.get("/api/customer/vehicles/by-plate/12")
        assert bad_plate.status_code == 400
        assert bad_plate.json()["error"]["code"] == "INVALID_PLATE"


class TestUniformErrorHandling:
    def test_malformed_json_and_unknown_route_return_uniform_json(self) -> None:
        client = _auth_client(role="ADMIN")

        bad_json = client.post(
            "/api/customer/customers",
            data="{json-invalido",
            content_type="application/json",
        )
        assert bad_json.status_code == 400
        assert bad_json.json()["error"]["code"] == "INVALID_JSON"

        not_found = client.get("/api/customer/ruta-inexistente")
        assert not_found.status_code == 404
        assert not_found.json()["error"]["code"] == "NOT_FOUND"

    def test_unexpected_internal_error_hides_internal_details(self) -> None:
        client = _auth_client(role="ADMIN")

        class _ExplodingQuery:
            def execute(self, **_kwargs):
                raise RuntimeError("SELECT * FROM customers -- password=supersecret")

        fake_container = build_container()
        with patch("presentation.views.customers.get_container") as mock_get_container:
            mock_get_container.return_value = type(
                "BrokenContainer", (), {"search_customers": _ExplodingQuery()}
            )()
            res = client.get("/api/customer/customers")

        assert res.status_code == 500
        assert res.json() == {
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Error interno del servidor.",
            }
        }
        assert "supersecret" not in json.dumps(res.json())
        assert "SELECT" not in json.dumps(res.json())
        void = fake_container
        del void
