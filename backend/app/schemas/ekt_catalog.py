"""Observed ekt.kz catalog payloads and the UC-01 product facts contract.

The upstream models reflect read-only responses observed on 2026-09-23.
They do not describe a cart API or guarantee that optional business facts exist.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class EktStore(BaseModel):
    id: int
    name: str
    quantity: int


class EktListProduct(BaseModel):
    id: int
    name: str
    article: str
    price: int = Field(description="Raw amount from ekt.kz; currency and units are unconfirmed")
    image: str | None
    url: str
    url_api_detail: str
    offers: list[Any] = Field(description="Observed empty; element structure is unknown")


class EktProductPage(BaseModel):
    page: int
    per_page: int
    count: int = Field(description="Number of items on this page, not a verified total")
    items: list[EktListProduct]


class EktDetailProduct(BaseModel):
    id: int
    name: str
    article: str
    description: str
    price: int = Field(description="Raw amount from ekt.kz; currency and units are unconfirmed")
    quantity: int
    stores: list[EktStore]
    image: str | None
    url: str
    offers: list[Any] = Field(description="Observed empty; element structure is unknown")
    properties: dict[str, str | list[str]] = Field(
        description="Variable property codes; string and string-array values observed"
    )


class EktError(BaseModel):
    error: str


class CatalogProductFacts(BaseModel):
    """Minimum facts for UC-01/02, derived from a successful detail response."""

    source: Literal["ekt.kz"] = "ekt.kz"
    fetched_at: datetime = Field(description="Time our backend fetched the upstream response")
    id: int
    article: str
    name: str
    description: str
    properties: dict[str, str | list[str]]
    price_raw: int = Field(description="Do not display with a currency until units are confirmed")
    quantity_total: int
    stores: list[EktStore]
    product_url: str
    image_url: str | None
    category: str | None = Field(
        default=None, description="No stable top-level category field observed"
    )
    certificate_url: str | None = Field(
        default=None, description="Unknown when absent; no certificate field observed"
    )
