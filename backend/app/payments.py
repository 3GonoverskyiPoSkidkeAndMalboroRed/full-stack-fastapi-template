"""Helpers for the (simulated) card payment flow.

Security note: raw card data (PAN, CVC) is never persisted or logged. Only
masked fields (brand, last4, expiry, cardholder name) are stored — enough for
displaying saved cards and the refund flow.

Card number / expiry / CVC are intentionally NOT validated: any digits are
accepted (this is a demo checkout, not a real payment gateway). The cardholder
name is still validated — it must be Latin letters, as on a real card.
"""

import re

_NON_DIGIT_RE = re.compile(r"\D")
_LATIN_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .'-]*$")


class CardValidationError(ValueError):
    """Raised when the cardholder name is invalid."""


def normalize_card_number(number: str) -> str:
    return _NON_DIGIT_RE.sub("", number)


def detect_brand(number: str) -> str:
    if number.startswith("4"):
        return "Visa"
    prefix4 = int(number[:4]) if number[:4].isdigit() else 0
    if 2200 <= prefix4 <= 2204:
        return "Mir"
    if number[:2] in {"51", "52", "53", "54", "55"} or 2221 <= prefix4 <= 2720:
        return "Mastercard"
    if number[:2] in {"34", "37"}:
        return "Amex"
    return "Карта"


def latin_name_valid(name: str) -> bool:
    return bool(_LATIN_NAME_RE.match(name.strip()))


class MaskedCard:
    """Storable, non-sensitive representation of a card."""

    def __init__(
        self,
        *,
        brand: str,
        last4: str,
        exp_month: int,
        exp_year: int,
        cardholder_name: str,
    ) -> None:
        self.brand = brand
        self.last4 = last4
        self.exp_month = exp_month
        self.exp_year = exp_year
        self.cardholder_name = cardholder_name


def mask_card(
    *,
    card_number: str,
    exp_month: int,
    exp_year: int,
    cardholder_name: str,
) -> MaskedCard:
    """Strip raw card fields down to the maskable parts.

    Only the cardholder name is validated (Latin letters). The PAN and CVC are
    intentionally not returned or stored.
    """
    if not latin_name_valid(cardholder_name):
        raise CardValidationError("Имя и фамилия на карте — только латиницей")
    number = normalize_card_number(card_number)
    return MaskedCard(
        brand=detect_brand(number) if number else "Карта",
        last4=number[-4:] if number else "",
        exp_month=exp_month,
        exp_year=exp_year,
        cardholder_name=cardholder_name.strip(),
    )
