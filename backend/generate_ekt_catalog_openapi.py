"""Generate or check the documented ekt.kz catalog OpenAPI contract.

Run from backend/: uv run python generate_ekt_catalog_openapi.py [--check]
This contract describes the partner's observed read-only API; it serves no routes.
"""

import argparse
import json
from pathlib import Path

from fastapi import FastAPI, Query

from app.schemas.ekt_catalog import (
    CatalogProductFacts,
    EktDetailProduct,
    EktError,
    EktProductPage,
)

OUTPUT = Path(__file__).resolve().parent.parent / "contracts" / "ekt-catalog.openapi.json"


def build_schema() -> dict:
    app = FastAPI(
        title="ekt.kz catalog contract (observed)",
        version="2026-09-23",
        description=(
            "Read-only partner API observed on 2026-09-23. "
            "The paths are documentation only and are not implemented by this project."
        ),
    )

    @app.get(
        "/api/products",
        response_model=EktProductPage,
        responses={401: {"model": EktError}},
        tags=["partner catalog"],
    )
    def list_products(page: int | None = Query(default=None, description="Page number")):
        raise NotImplementedError

    @app.get(
        "/api/products/detail",
        response_model=EktDetailProduct,
        responses={400: {"model": EktError}, 401: {"model": EktError}, 404: {"model": EktError}},
        tags=["partner catalog"],
    )
    def product_detail(id: int = Query(description="Product ID; not an article")):
        raise NotImplementedError

    schema = app.openapi()
    # FastAPI adds 422 for its own parameter validation. The partner returned
    # 400 for an invalid detail ID and 200 for an invalid page value.
    for path in schema["paths"].values():
        for operation in path.values():
            operation["responses"].pop("422", None)
    schema["components"]["schemas"].pop("HTTPValidationError", None)
    schema["components"]["schemas"].pop("ValidationError", None)
    schema["servers"] = [{"url": "https://ekt.kz"}]
    schema["components"]["securitySchemes"] = {"BasicAuth": {"type": "http", "scheme": "basic"}}
    schema["security"] = [{"BasicAuth": []}]

    facts_schema = CatalogProductFacts.model_json_schema(
        ref_template="#/components/schemas/{model}"
    )
    schema["components"]["schemas"].update(facts_schema.pop("$defs", {}))
    schema["components"]["schemas"]["CatalogProductFacts"] = facts_schema
    return schema


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail if generated contract differs")
    args = parser.parse_args()
    content = json.dumps(build_schema(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            raise SystemExit(f"Outdated contract: {OUTPUT}")
        print("ekt.kz OpenAPI contract is current")
    else:
        OUTPUT.write_text(content)
        print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
