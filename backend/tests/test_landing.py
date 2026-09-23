# ruff: noqa: RUF001
"""Offline regression checks for HackAlem UC-01…05 and section 5 inputs.

Catalogue details are controlled fixtures here. Real integration is checked by
frontend/e2e/landing.live.spec.ts; these checks never call OpenAI or ekt.kz.
"""

import asyncio
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


def absent_lamp(state):
    return state[515291].model_copy(
        update={
            "id": 101,
            "article": "absent-lamp",
            "name": "Светильник OLD 21W 6500K",
            "quantity": 0,
            "warnings": [],
            "url": "https://ekt.kz/catalog/lighting/surface/old/",
            "properties": {
                "MOSHCHNOST_W": "21",
                "SPOSOB_MONTAZHA": "Накладной",
                "TSVETOVAYA_TEMPERATURA": "6500",
            },
        }
    )


def test_analogs_expand_search_and_exclude_accessories(client, monkeypatch):
    _, state = client
    source = absent_lamp(state)
    state[102] = source.model_copy(
        update={"id": 102, "name": "Решетка для светильника", "quantity": 20}
    )
    state[103] = source.model_copy(
        update={
            "id": 103,
            "article": "led-24",
            "name": "LED NEW 24W 6500K",
            "quantity": 7,
            "url": "https://ekt.kz/catalog/lighting/led/new/",
            "properties": {
                "MOSHCHNOST_W": "24",
                "SPOSOB_MONTAZHA": "Накладной",
                "TSVETOVAYA_TEMPERATURA": "6500",
            },
        }
    )

    async def search(query):
        return [103] if query.startswith("светильник ") else [102]

    async def category_products(_):
        return []

    monkeypatch.setattr(landing, "search_site", search)
    monkeypatch.setattr(landing, "category_products", category_products)
    monkeypatch.setattr(landing, "local_search", lambda _: [])
    results = asyncio.run(landing.analogs(source))
    assert [a.product.id for a in results] == [103]
    assert results[0].product.quantity == 7
    assert "Способ монтажа" in results[0].reason
    assert any("21 → 24" in line for line in results[0].differences)


@pytest.mark.parametrize("intent_name", ["product", "prepare"])
def test_each_absent_product_gets_analog_without_cart_mutation(client, monkeypatch, intent_name):
    browser, state = client
    source = absent_lamp(state)
    candidate = source.model_copy(update={"id": 103, "quantity": 7, "article": "replacement"})

    async def interpret(_session, _payload):
        return landing.Intent(
            intent=intent_name,
            items=[landing.IntentItem(query="светильники", product_id=None, quantity=1)],
            reply="Проверено",
            extracted=[],
        )

    async def resolve(_):
        return [state[515291], source] if intent_name == "product" else [source]

    async def analogs(p):
        assert p.id == source.id
        return [
            landing.Alternative(
                product=candidate, reason="Совпадают характеристики", differences=[]
            )
        ]

    monkeypatch.setattr(landing, "interpret", interpret)
    monkeypatch.setattr(landing, "resolve", resolve)
    monkeypatch.setattr(landing, "analogs", analogs)
    response = browser.post("/api/chat", json={"text": "Есть ли светильники?"})
    assert response.status_code == 200
    assert len(response.json()["alternatives"]) >= 1
    assert response.json()["proposal"] is None
    assert browser.get("/api/cart").json()["count"] == 0


def test_sparse_rcbo_parameters_match_but_other_current_is_rejected(client):
    _, state = client
    source = absent_lamp(state).model_copy(
        update={"name": "007886 Диф.авт. 1p+N 16А (30мА)", "properties": {}}
    )
    candidate = source.model_copy(
        update={
            "id": 103,
            "quantity": 5,
            "name": "АВДТ DX3 (1П+Н) 16А (30мA-AC)",
            "properties": {"KOLICHESTVO_POLYUSOV": "2", "NOMINALNYY_TOK": "16 А"},
        }
    )
    result = landing.analog_candidate(source, candidate)
    assert result and "Ток утечки" in result[1].reason
    candidate.properties["NOMINALNYY_TOK"] = "25 А"
    assert landing.analog_candidate(source, candidate) is None
    candidate.properties.pop("NOMINALNYY_TOK")
    candidate.name = "АВДТ 1P+N C32 30mA"
    assert landing.analog_candidate(source, candidate) is None
    assert landing.parameter_value("1,6А") != landing.parameter_value("16А")


def test_terms_preserve_sections_lists_and_flag_conflicting_versions():
    html = """<nav>Личный кабинет</nav>
    <div class="row"><div><h5>Оплата</h5><p>Физическим лицам:</p>
    <ul><li>Картой онлайн</li><li>Наличными при получении</li></ul>
    <p>Юридическим лицам:</p><ul><li>Перечислением на счёт</li></ul></div></div>
    <div class="row"><div><h5>Доставка</h5><span>1. В течение 48 часов.</span><br>
    <span>2. Бесплатно свыше 30 000 тенге.</span></div></div>
    <div class="row"><h5>Доставка</h5><p>Бесплатно свыше 15 000 тенге.</p></div>
    <footer>Вы добавили товар. Личный кабинет</footer>"""
    terms = landing.parse_terms(html)
    assert "Физическим лицам:\n- Картой онлайн\n- Наличными" in terms.payment
    assert "Юридическим лицам:\n- Перечислением" in terms.payment
    assert "48 часов.\n2." in terms.delivery
    assert "различающихся версий" in terms.delivery
    assert "Личный кабинет" not in terms.payment + terms.delivery
    assert "Вы добавили" not in terms.delivery
    with pytest.raises(ValueError):
        landing.parse_terms("<p>Нет разделов условий покупки</p>")


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

    async def fixture_contacts():
        return {
            "phone": "tel:+77273468888",
            "whatsapp": "https://wa.me/77782768888/",
            "fetched_at": "2026-09-23T00:00:00Z",
        }

    monkeypatch.setattr(landing, "manager_contacts", fixture_contacts)
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


def test_cancel_old_quantity_does_not_cancel_new_proposal(client):
    browser, _ = client
    old = prepare(browser, 1).json()
    current = prepare(browser, 2).json()
    browser.post("/api/cart/cancel", json={"proposal_id": old["id"]}).raise_for_status()
    assert browser.get("/api/cart").json()["count"] == 0
    response = confirm(browser, current)
    assert response.status_code == 200
    assert response.json()["count"] == 2


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
        assert all(row["code"] in content["text"] for row in entry["expected_items"])


def test_broken_pdf_is_rejected():
    with pytest.raises(HTTPException) as exc:
        landing.file_content(landing.Attachment(name="broken.pdf", data="bm90IGEgcGRm"))
    assert exc.value.status_code == 422


def mock_document_intent(monkeypatch, items):
    async def interpret(_session, _payload):
        return landing.Intent(
            intent="prepare",
            items=[landing.IntentItem(query=q, product_id=None, quantity=n) for q, n in items],
            reply="Проверяю спецификацию",
            extracted=[],
        )

    monkeypatch.setattr(landing, "interpret", interpret)


def document_request(browser):
    # Extraction is controlled, never represented as a live model result.
    return browser.post(
        "/api/chat",
        json={
            "text": "Подготовь позиции из файла",
            "attachments": [{"name": "spec.txt", "data": "eA=="}],
        },
    )


def test_document_exceptions_stay_visible_and_only_chosen_rows_enter_cart(client, monkeypatch):
    browser, state = client
    product = state[515291]
    mock_document_intent(
        monkeypatch, [(product.article, 2), ("UNKNOWN", 1), ("лампа", 1), (product.article, None)]
    )

    async def resolve(item):
        if item.query == "UNKNOWN":
            return []
        return [product]

    monkeypatch.setattr(landing, "resolve", resolve)
    response = document_request(browser)
    assert response.status_code == 200
    reply = response.json()
    assert [r["status"] for r in reply["review"]] == [
        "ready",
        "not_found",
        "ambiguous",
        "needs_quantity",
    ]
    assert [r["position"] for r in reply["review"]] == [1, 2, 3, 4]
    assert reply["review"][3]["quantity"] is None
    assert reply["review"][2]["product_id"] is None
    assert reply["proposal"] is None
    assert browser.get("/api/cart").json()["count"] == 0
    ready = reply["review"][0]
    proposal = browser.post(
        "/api/cart/prepare",
        json={"items": [{"product_id": ready["product_id"], "quantity": ready["quantity"]}]},
    ).json()
    assert browser.get("/api/cart").json()["count"] == 0
    assert confirm(browser, proposal).json()["count"] == 2


@pytest.mark.parametrize(
    "quantities,expected",
    [
        ([4, 4], ["insufficient_stock", "insufficient_stock"]),
        ([2, 3], ["ready", "ready"]),
        ([0, -1], ["invalid_quantity", "invalid_quantity"]),
    ],
)
def test_document_totals_include_duplicates_and_existing_cart(
    client, monkeypatch, quantities, expected
):
    browser, state = client
    product = state[515291]
    product.quantity = 10
    confirm(browser, prepare(browser, 3).json()).raise_for_status()
    mock_document_intent(monkeypatch, [(product.article, n) for n in quantities])

    async def resolve(_):
        return [product]

    monkeypatch.setattr(landing, "resolve", resolve)
    reply = document_request(browser).json()
    assert [r["status"] for r in reply["review"]] == expected
    assert all(r["available"] == 7 for r in reply["review"])
    assert reply["proposal"] is None
    assert browser.get("/api/cart").json()["count"] == 3


def test_document_zero_stock_multiple_and_failed_lookup_are_not_dropped(client, monkeypatch):
    browser, state = client
    product = state[515291]
    absent = product.model_copy(update={"id": 111, "article": "ABSENT", "quantity": 0})
    mock_document_intent(monkeypatch, [("ABSENT", 1), (product.article, 3), ("DOWN", 1)])

    async def resolve(item):
        if item.query == "DOWN":
            raise HTTPException(503, "Unavailable")
        return [absent] if item.query == "ABSENT" else [product]

    async def analogs(_):
        return [landing.Alternative(product=product, reason="Совпадают свойства", differences=[])]

    monkeypatch.setattr(landing, "resolve", resolve)
    monkeypatch.setattr(landing, "analogs", analogs)
    monkeypatch.setattr(landing, "multiple", lambda _: 2)
    reply = document_request(browser).json()
    assert [r["status"] for r in reply["review"]] == [
        "out_of_stock",
        "invalid_multiple",
        "unavailable",
    ]
    assert reply["alternatives"][0]["product"]["id"] == product.id
    assert reply["review"][0]["product_id"] == absent.id
    assert reply["proposal"] is None
    assert browser.get("/api/cart").json()["items"] == []


@pytest.mark.parametrize("intent_name", ["order_help", "capabilities"])
def test_help_is_actionable_and_preserves_pending_consent(client, monkeypatch, intent_name):
    browser, _ = client
    proposal = prepare(browser, 2).json()

    async def interpret(_session, _payload):
        return landing.Intent(intent=intent_name, items=[], reply="Я помогу", extracted=[])

    monkeypatch.setattr(landing, "interpret", interpret)
    reply = browser.post("/api/chat", json={"text": "Как мне заказать товар"}).json()
    assert len(reply["text"]) > 150
    assert "отдельн" in reply["text"]
    assert reply["suggestions"]
    assert reply["proposal"]["id"] == proposal["id"]
    assert browser.get("/api/cart").json()["count"] == 0
    assert confirm(browser, proposal).json()["count"] == 2


def test_manager_is_user_sent_draft_without_documents_or_history(client):
    browser, _ = client
    confirm(browser, prepare(browser, 2).json()).raise_for_status()
    session = next(iter(landing.sessions.values()))
    session.history = [{"text": "PRIVATE CUSTOMER MESSAGE", "files": ["private-file.pdf"]}]
    response = browser.get("/api/manager")
    assert response.status_code == 200
    manager = response.json()
    assert manager["sent"] is False
    assert manager["source"] == landing.CONTACTS_URL
    assert manager["phone"].startswith("tel:")
    assert "200300285_ — 2 шт." in manager["draft"]
    assert "PRIVATE" not in manager["draft"] and "private-file" not in manager["draft"]
    assert browser.get("/api/cart").json()["count"] == 2


def test_model_outage_offers_manager_and_invalidates_hidden_consent(client, monkeypatch):
    browser, _ = client
    proposal = prepare(browser).json()

    async def interpret(_session, _payload):
        raise HTTPException(502, "Model unavailable")

    monkeypatch.setattr(landing, "interpret", interpret)
    reply = browser.post("/api/chat", json={"text": "Посмотри другую позицию"}).json()
    assert reply["manager"]["sent"] is False
    assert reply["website"] == "https://ekt.kz/"
    assert confirm(browser, proposal).status_code == 409
    assert browser.get("/api/cart").json()["count"] == 0


def test_known_code_in_brand_phrase_and_spaced_reference_are_exact(client):
    _, state = client
    p = state[515291]
    row = landing.review_row(
        1,
        landing.IntentItem(query="Legrand 027228", product_id=None, quantity=2),
        [p],
        landing.Session(),
    )
    assert row.product_id == p.id and row.status == "ready"
    assert landing.local_search("270 05") == [515280]
    p = p.model_copy(update={"id": 515280, "name": "027005 АВ DRX125 MT", "article": "200300274_"})
    row = landing.review_row(
        1, landing.IntentItem(query="270 05", product_id=None, quantity=2), [p], landing.Session()
    )
    assert row.status == "ready"


def test_spreadsheets_keep_header_meaning_duplicate_rows_and_formula_value():
    path = ROOT / "out/inputs/purchase_request.xlsx"
    result = landing.file_content(
        landing.Attachment(name=path.name, data=base64.b64encode(path.read_bytes()).decode())
    )
    text = result["text"]
    assert text.count('"Код производителя": "027005"') == 2
    assert '"Код производителя": "027028"' in text
    assert '"Количество": 1.0' in text


def test_scan_has_no_hidden_text_and_photo_bytes_match_manifest():
    import pymupdf

    with pymupdf.open(ROOT / "out/inputs/delivery_note_scan.pdf") as pdf:
        assert pdf.page_count == 1 and not pdf[0].get_text().strip()
    with pymupdf.open(ROOT / "out/inputs/project_specification.pdf") as pdf:
        assert pdf.page_count == 2
        assert "ярп4520" in pdf[1].get_text()


@pytest.mark.parametrize("available", [True, False])
def test_terms_keep_visible_consent_and_offer_manager_on_outage(client, monkeypatch, available):
    browser, _ = client
    proposal = prepare(browser, 2).json()

    async def interpret(_session, _payload):
        return landing.Intent(intent="terms", items=[], reply="Условия", extracted=[])

    async def terms():
        if not available:
            raise HTTPException(503, "Terms unavailable")
        return landing.Terms(
            source=landing.TERMS_URL,
            fetched_at=landing.now(),
            payment="Картой",
            delivery="Уточните адрес",
            minimum="Не указан",
        )

    monkeypatch.setattr(landing, "interpret", interpret)
    monkeypatch.setattr(landing, "terms", terms)
    reply = browser.post("/api/chat", json={"text": "Как оплатить?"}).json()
    assert reply["proposal"]["id"] == proposal["id"]
    assert browser.get("/api/cart").json()["count"] == 0
    if not available:
        assert reply["manager"]["sent"] is False
        assert reply["website"] == landing.TERMS_URL
        assert reply["terms"] is None
    assert confirm(browser, proposal).json()["count"] == 2
