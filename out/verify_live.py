# ruff: noqa: RUF001
"""Upload each manifest input to the real app, using configured OpenAI and ekt.kz.

Run explicitly: backend/.venv/bin/python out/verify_live.py
No fixtures or prerecorded responses. API charges apply. Only bundled, non-client
inputs are recorded; credentials, cookies and confirmation tokens are omitted.
"""

import asyncio
import base64
import hashlib
import json
import subprocess
import sys
import time
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app import landing  # noqa: E402

OUT = ROOT / "out"


def snapshot(data):
    return {
        k: data.get(k)
        for k in (
            "text",
            "extracted",
            "review",
            "products",
            "alternatives",
            "suggestions",
            "website",
            "manager",
        )
        if data.get(k)
    }


async def post(client, path, data):
    r = await client.post(path, json=data)
    r.raise_for_status()
    return r.json()


async def main():
    manifest = json.loads((OUT / "manifest.json").read_text())
    stamp = datetime.now(UTC).isoformat()
    previous = (
        json.loads((OUT / "verification.json").read_text())
        if (OUT / "verification.json").exists()
        else {}
    )
    history = previous.get("previous_runs", [])
    if previous.get("kind") == "live_processing_of_realistic_inputs":
        history.append(
            {
                k: previous.get(k)
                for k in (
                    "checked_at",
                    "implementation_sha256",
                    "files",
                    "conversation",
                    "all_passed",
                )
            }
        )
    report = {
        "kind": "live_processing_of_realistic_inputs",
        "checked_at": stamp,
        "git_head": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "implementation_sha256": {
            name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
            for name in ("backend/app/landing.py", "index.html", "out/manifest.json")
        },
        "files": [],
        "conversation": [],
        "previous_runs": history,
    }
    observed = {
        "kind": "observed_live_responses_not_reference_answers",
        "checked_at": stamp,
        "files": [],
        "conversation": [],
    }
    async with landing.lifespan(landing.app):
        for case in manifest["files"]:
            record = {"file": case["path"], "sha256": case["sha256"], "passed": False}
            start = time.perf_counter()
            try:
                async with httpx.AsyncClient(
                    transport=httpx.ASGITransport(app=landing.app),
                    base_url="http://testserver",
                    timeout=100,
                ) as client:
                    info = (await client.get("/api/session")).json()
                    assert info["live"] and info["ai"], (
                        "Missing configured catalogue/AI credentials"
                    )
                    client.headers["X-CSRF-Token"] = info["csrf"]
                    data = (OUT / case["path"]).read_bytes()
                    assert hashlib.sha256(data).hexdigest() == case["sha256"], "Input hash changed"
                    reply = await post(
                        client,
                        "/api/chat",
                        {
                            "text": case["prompt"],
                            "attachments": [
                                {
                                    "name": Path(case["path"]).name,
                                    "data": base64.b64encode(data).decode(),
                                }
                            ],
                        },
                    )
                    record["seconds"] = round(time.perf_counter() - start, 3)
                    record["model"] = info["model"]
                    actual = [[row["product_id"], row["quantity"]] for row in reply["review"]]
                    expected = [[row["id"], row["quantity"]] for row in case["expected_items"]]
                    record["actual_items"] = actual
                    record["expected_items"] = expected
                    record["direct_match"] = actual == expected
                    record["statuses"] = [row["status"] for row in reply["review"]]
                    observed["files"].append(
                        {
                            "file": case["path"],
                            "prompt": case["prompt"],
                            "response": snapshot(reply),
                        }
                    )
                    if case.get("requires_clarification"):
                        assert reply["review"] and all(
                            r["product_id"] is None and r["status"] in {"ambiguous", "not_found"}
                            for r in reply["review"]
                        ), "Unclear marking was treated as an exact match"
                        assert "код производителя" in reply["text"] and reply["suggestions"]
                        assert reply["proposal"] is None
                        assert (await client.get("/api/cart")).json()["count"] == 0
                        clarified = await post(client, "/api/chat", {"text": case["clarification"]})
                        observed["files"][-1]["clarification"] = {
                            "prompt": case["clarification"],
                            "response": snapshot(clarified),
                        }
                        assert [p["id"] for p in clarified["products"]] == [
                            r["id"] for r in case["expected_items"]
                        ]
                        assert clarified["proposal"] is None
                        record["clarified_product_ids"] = [p["id"] for p in clarified["products"]]
                        record["outcome"] = "clarification_required_then_catalogue_match"
                    else:
                        assert actual == expected, (
                            "Extracted item identities/counts/quantities differ from input"
                        )
                        record["outcome"] = "direct_catalogue_match"
                    assert reply["proposal"] is None, "Document silently prepared cart"
                    assert (await client.get("/api/cart")).json()["count"] == 0, (
                        "Upload changed cart"
                    )
                    record["cart_before_confirmation"] = 0
                    for p in reply["products"]:
                        source = await client.get(f"/api/catalog/detail?id={p['id']}")
                        source.raise_for_status()
                        facts = source.json()
                        for key in (
                            "article",
                            "price",
                            "quantity",
                            "properties",
                            "stores",
                        ):
                            assert p[key] == facts[key], f"Catalog fact mismatch: {key}"
                        if p["quantity"] == 0:
                            assert reply["alternatives"] and all(
                                a["reason"] and a["product"]["quantity"] > 0
                                for a in reply["alternatives"]
                            ), "Missing explained available analog"
                    if case.get("external_prices"):
                        assert all(
                            p["price"] not in case["external_prices"] for p in reply["products"]
                        ), "Document prices replaced catalogue prices"
                    if case.get("confirm_cart"):
                        assert all(r["status"] == "ready" for r in reply["review"]), (
                            "Expected quantities cannot currently be ordered; inspect stock"
                        )
                        quantities = defaultdict(int)
                        for row in reply["review"]:
                            quantities[row["product_id"]] += row["quantity"]
                        proposal = await post(
                            client,
                            "/api/cart/prepare",
                            {
                                "items": [
                                    {"product_id": pid, "quantity": qty}
                                    for pid, qty in quantities.items()
                                ]
                            },
                        )
                        await post(client, "/api/chat", {"text": "ок"})
                        assert (await client.get("/api/cart")).json()["count"] == 0
                        cart = await post(
                            client,
                            "/api/cart/confirm",
                            {
                                "proposal_id": proposal["id"],
                                "confirmation": "Да, добавить",
                            },
                        )
                        assert {r["product_id"]: r["quantity"] for r in cart["items"]} == dict(
                            quantities
                        )
                        assert cart["total"] == sum(
                            r["price"] * r["quantity"] for r in cart["items"]
                        )
                        assert (await client.get(cart["url"])).status_code == 200
                        assert (await client.get("/api/cart")).json() == cart
                        record["confirmed_cart"] = cart
                    record["passed"] = True
            except Exception as exc:
                record["error"] = f"{type(exc).__name__}: {exc}"
            report["files"].append(record)
            print(
                case["path"],
                "PASS" if record["passed"] else "FAIL",
                record.get("actual_items"),
                flush=True,
            )
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=landing.app), base_url="http://testserver"
        ) as client:
            info = (await client.get("/api/session")).json()
            client.headers["X-CSRF-Token"] = info["csrf"]
            for prompt in [
                "Как мне заказать товар",
                "Если я хочу закаазть товарр как это сделать",
                "С чем ты можешь помочь",
                "Хочу поговорить с менеджером",
            ]:
                record = {"prompt": prompt, "passed": False}
                try:
                    reply = await post(client, "/api/chat", {"text": prompt})
                    observed["conversation"].append({"prompt": prompt, "response": snapshot(reply)})
                    assert len(reply["text"]) > 150, (
                        "Empty acknowledgement instead of useful guidance"
                    )
                    if "менеджер" in prompt:
                        assert (
                            reply["manager"]["sent"] is False
                            and reply["manager"]["source"] == landing.CONTACTS_URL
                        )
                        assert reply["manager"]["phone"] or reply["manager"]["whatsapp"], (
                            "Could not verify contact channel"
                        )
                    else:
                        assert reply["suggestions"], "No actionable next step"
                        assert "отдельн" in reply["text"].lower(), "Consent guidance missing"
                    assert (await client.get("/api/cart")).json()["count"] == 0
                    record["passed"] = True
                except Exception as exc:
                    record["error"] = f"{type(exc).__name__}: {exc}"
                report["conversation"].append(record)
                print("DIALOG", prompt, "PASS" if record["passed"] else "FAIL", flush=True)
    report["all_passed"] = all(x["passed"] for x in report["files"] + report["conversation"])
    report["all_files_matched_without_clarification"] = all(
        x.get("direct_match", False) for x in report["files"]
    )
    (OUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    (OUT / "observed-session.json").write_text(
        json.dumps(observed, ensure_ascii=False, indent=2) + "\n"
    )
    raise SystemExit(0 if report["all_passed"] else 1)


if __name__ == "__main__":
    asyncio.run(main())
