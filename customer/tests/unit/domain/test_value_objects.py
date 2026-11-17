"""Pruebas unitarias de los Value Objects Plate, PhoneNumber y Email."""

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from domain.errors import DomainError, InvalidEmailError, InvalidPhoneError, InvalidPlateError
from domain.value_objects.email import Email
from domain.value_objects.phone_number import PhoneNumber
from domain.value_objects.plate import Plate


class TestPlate:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("1234-abc", "1234-ABC"),
            ("  4821 ABC  ", "4821 ABC"),
            ("abc12", "ABC12"),
            ("1234567890", "1234567890"),
            ("ab-123-cd", "AB-123-CD"),
        ],
    )
    def test_normalizes_valid_plates_preserving_hyphens(self, raw: str, expected: str) -> None:
        plate = Plate(raw)

        assert plate.value == expected
        assert str(plate) == expected

    @pytest.mark.parametrize(
        "invalid",
        ["", "   ", "1234", "  1234  ", "12345678901", None, 12345],
    )
    def test_rejects_invalid_plates(self, invalid: object) -> None:
        with pytest.raises(InvalidPlateError) as exc_info:
            Plate(invalid)  # type: ignore[arg-type]

        assert isinstance(exc_info.value, DomainError)
        assert exc_info.value.code == "INVALID_PLATE"

    def test_is_immutable_and_compares_by_value(self) -> None:
        p1 = Plate(" 1234-abc ")
        p2 = Plate("1234-ABC")
        p3 = Plate("9999-XYZ")

        assert p1 == p2
        assert hash(p1) == hash(p2)
        assert p1 != p3

        with pytest.raises(FrozenInstanceError):
            p1.value = "0000-AAA"  # type: ignore[misc]


class TestPhoneNumber:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("70012345", "70012345"),
            ("  +591 700-123-45  ", "+59170012345"),
            ("1234567", "1234567"),
            ("+123456789012345", "+123456789012345"),
            ("700 12 345", "70012345"),
        ],
    )
    def test_normalizes_valid_phone_numbers(self, raw: str, expected: str) -> None:
        phone = PhoneNumber(raw)

        assert phone.value == expected
        assert str(phone) == expected

    @pytest.mark.parametrize(
        "invalid",
        [
            "",
            "   ",
            "123456",  # menos de 7 dígitos
            "1234567890123456",  # más de 15 dígitos
            "70012abc",  # letras
            "+591+70012345",  # '+' intermedio
            "++59170012345",  # doble '+'
            "(591) 70012345",  # caracteres no permitidos
            None,
            70012345,
        ],
    )
    def test_rejects_invalid_phone_numbers(self, invalid: object) -> None:
        with pytest.raises(InvalidPhoneError) as exc_info:
            PhoneNumber(invalid)  # type: ignore[arg-type]

        assert exc_info.value.code == "INVALID_PHONE"

    def test_is_immutable_and_compares_by_value(self) -> None:
        ph1 = PhoneNumber("+591 700-12345")
        ph2 = PhoneNumber("+59170012345")
        ph3 = PhoneNumber("70099999")

        assert ph1 == ph2
        assert hash(ph1) == hash(ph2)
        assert ph1 != ph3

        with pytest.raises(FrozenInstanceError):
            ph1.value = "70000000"  # type: ignore[misc]


class TestEmail:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("  Carlos.Perez@CarWash.BO ", "carlos.perez@carwash.bo"),
            ("usuario+tag@dominio.com", "usuario+tag@dominio.com"),
            ("a@b.co", "a@b.co"),
        ],
    )
    def test_normalizes_valid_emails(self, raw: str, expected: str) -> None:
        email = Email(raw)

        assert email.value == expected
        assert str(email) == expected

    @pytest.mark.parametrize("empty", [None, "", "   "])
    def test_from_optional_returns_none_for_missing_or_blank_values(self, empty: str | None) -> None:
        assert Email.from_optional(empty) is None

    def test_from_optional_normalizes_or_returns_existing_email(self) -> None:
        parsed = Email.from_optional("  ANA@MAIL.COM ")
        assert parsed == Email("ana@mail.com")
        assert Email.from_optional(parsed) is parsed

    @pytest.mark.parametrize(
        "invalid",
        [
            "",
            "   ",
            "sin-arroba.com",
            "usuario@",
            "@dominio.com",
            "usuario@dominio",
            "usuario@dominio.c",
            "a@b@c.com",
            "usuario con espacio@dominio.com",
            ".usuario@dominio.com",
            "usuario.@dominio.com",
            "usuario..doble@dominio.com",
            "usuario@-dominio.com",
            f"{'a' * 245}@dominio.com",  # > 254 caracteres
            123,
        ],
    )
    def test_rejects_invalid_emails(self, invalid: object) -> None:
        with pytest.raises(InvalidEmailError) as exc_info:
            Email(invalid)  # type: ignore[arg-type]

        assert exc_info.value.code == "INVALID_EMAIL"

    def test_is_immutable_and_compares_by_value(self) -> None:
        e1 = Email("USER@Example.com")
        e2 = Email("user@example.com")
        e3 = Email("other@example.com")

        assert e1 == e2
        assert hash(e1) == hash(e2)
        assert e1 != e3

        with pytest.raises(FrozenInstanceError):
            e1.value = "otro@example.com"  # type: ignore[misc]
