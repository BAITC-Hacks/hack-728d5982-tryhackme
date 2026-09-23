"""Offline regression checks for HackAlem UC-01/04/05 and section 5 inputs.

Catalogue details are controlled fixtures here. Real integration is checked by
frontend/e2e/landing.live.spec.ts; these checks never call OpenAI or ekt.kz.
"""

import base64
import hashlib
import json
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import landing
from app.schemas.ekt_catalog import EktDetailProduct, EktProductPage

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "docs/source of truth/assets"


@pytest.fixture
def client(monkeypatch):
    landing.sessions.clear()
    product = landing.ProductFacts(
        **json.loads((ASSETS / "detail.json").read_text()), fetched_at=landing.now()
    )
    state = {product.id: product}

    async def fixture_detail(pid, *, fresh=False):
        if pid not in state:
            raise HTTPException(404, "Fixture product not found")
        return state[pid].model_copy(deep=True)

    monkeypatch.setattr(landing, "detail", fixture_detail)
    with TestClient(landing.app) as browser:
        session = browser.get("/api/session").json()
        browser.headers["X-CSRF-Token"] = session["csrf"]
        yield browser, state
    landing.sessions.clear()


def prepare(browser, quantity=3):
    return browser.post(
        "/api/cart/prepare", json={"items": [{"product_id": 515291, "quantity": quantity}]}
    )


def confirm(browser, proposal):
    return browser.post(
        "/api/cart/confirm",
        json={"proposal_id": proposal["id"], "confirmation": "Да, добавить"},
    )


def test_partner_fixtures_match_contract():
    for source in ASSETS.glob("products*.json"):
        page = EktProductPage.model_validate_json(source.read_text())
        assert page.count == len(page.items)
    product = EktDetailProduct.model_validate_json((ASSETS / "detail.json").read_text())
    assert product.id == 515291
    assert product.quantity == sum(store.quantity for store in product.stores)


def test_consent_actual_cart_url_and_replay(client):
    browser, _ = client
    proposal = prepare(browser).json()
    assert browser.get("/api/cart").json()["count"] == 0
    browser.post("/api/chat", json={"text": "ок"}).raise_for_status()
    assert browser.get("/api/cart").json()["count"] == 0
    response = confirm(browser, proposal)
    assert response.status_code == 200
    cart = response.json()
    assert cart["count"] == 3
    assert cart["items"][0]["product_id"] == 515291
    assert cart["total"] == cart["items"][0]["price"] * 3
    page = browser.get(cart["url"])
    assert page.status_code == 200
    assert page.content == (ROOT / "index.html").read_bytes()
    assert browser.get("/api/cart").json() == cart
    assert confirm(browser, proposal).status_code == 409
    assert browser.get("/api/cart").json()["count"] == 3


def test_other_session_csrf_and_origin(client):
    browser, _ = client
    proposal = prepare(browser).json()
    with TestClient(landing.app) as other:
        other_session = other.get("/api/session").json()
        other.headers["X-CSRF-Token"] = other_session["csrf"]
        assert confirm(other, proposal).status_code == 409
        assert other.get("/api/cart").json()["count"] == 0
    # This path uses only catalogue fixtures; nested lifespan has no external IO.
    assert (
        browser.post(
            "/api/cart/confirm",
            headers={"X-CSRF-Token": ""},
            json={"proposal_id": proposal["id"], "confirmation": "Да, добавить"},
        ).status_code
        == 403
    )
    assert (
        browser.post(
            "/api/cart/confirm",
            headers={"Origin": "https://another.invalid"},
            json={"proposal_id": proposal["id"], "confirmation": "Да, добавить"},
        ).status_code
        == 403
    )
    assert browser.get("/api/cart").json()["count"] == 0


@pytest.mark.parametrize("quantity", [0, -1, 24])
def test_invalid_quantity_never_changes_cart(client, quantity):
    browser, _ = client
    assert prepare(browser, quantity).status_code in {409, 422}
    assert browser.get("/api/cart").json()["count"] == 0


@pytest.mark.parametrize("change", ["cancel", "expire", "price", "stock"])
def test_invalidated_proposal_never_changes_cart(client, change):
    browser, state = client
    proposal = prepare(browser).json()
    if change == "cancel":
        browser.post("/api/cart/cancel", json={"proposal_id": proposal["id"]})
    elif change == "expire":
        active = next(iter(landing.sessions.values())).proposal
        assert active is not None
        active.expires_at = 0
    elif change == "price":
        state[515291].price += 1
    else:
        state[515291].quantity = 1
    assert confirm(browser, proposal).status_code == 409
    assert browser.get("/api/cart").json()["count"] == 0


def test_batch_rejection_is_atomic(client):
    browser, state = client
    # Synthetic second product exists only in this offline test.
    state[999991] = state[515291].model_copy(update={"id": 999991, "article": "SYNTHETIC"})
    proposal = browser.post(
        "/api/cart/prepare",
        json={
            "items": [{"product_id": 515291, "quantity": 2}, {"product_id": 999991, "quantity": 1}]
        },
    ).json()
    state[999991].quantity = 0
    assert confirm(browser, proposal).status_code == 409
    assert browser.get("/api/cart").json()["items"] == []


def test_remove_requires_confirmation(client):
    browser, _ = client
    confirm(browser, prepare(browser).json()).raise_for_status()
    proposal = browser.post(
        "/api/cart/prepare",
        json={"action": "remove", "items": [{"product_id": 515291, "quantity": 1}]},
    ).json()
    assert browser.get("/api/cart").json()["count"] == 3
    response = browser.post(
        "/api/cart/confirm", json={"proposal_id": proposal["id"], "confirmation": "Да, удалить"}
    )
    assert response.status_code == 200
    assert response.json()["items"] == []


MANIFEST = json.loads((ROOT / "out/manifest.json").read_text())


@pytest.mark.parametrize("entry", MANIFEST["files"], ids=lambda entry: entry["path"])
def test_existing_input_examples_are_valid(entry):
    path = ROOT / "out" / entry["path"]
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == entry["sha256"]
    content = landing.file_content(
        landing.Attachment(name=path.name, data=base64.b64encode(raw).decode())
    )
    assert content["type"] in {"input_text", "input_image", "input_file"}
    if content["type"] == "input_text":
        assert "027005" in content["text"] and "027028" in content["text"]


def test_broken_pdf_is_rejected():
    with pytest.raises(HTTPException) as exc:
        landing.file_content(landing.Attachment(name="broken.pdf", data="bm90IGEgcGRm"))
    assert exc.value.status_code == 422
