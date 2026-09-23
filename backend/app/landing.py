"""Serve the single-file landing and a read-only, same-origin catalog gateway.

Run: uv run uvicorn app.landing:app --host 127.0.0.1 --port 8765
Credentials are read on the server only. This gateway has no cart/order mutations.
"""

import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import ValidationError

from app.schemas.ekt_catalog import EktDetailProduct, EktProductPage

ROOT = Path(__file__).resolve().parents[2]
app = FastAPI(title="ЭКТ landing catalog gateway")


@app.get("/", include_in_schema=False)
@app.get("/index.html", include_in_schema=False)
async def landing():
    return FileResponse(ROOT / "index.html")


@app.get("/api/catalog/status")
async def status() -> dict[str, bool]:
    return {"live": bool(os.getenv("EKT_API_USER") and os.getenv("EKT_API_PASSWORD"))}


async def upstream(path: str, params: dict[str, int]) -> dict:
    user, password = os.getenv("EKT_API_USER"), os.getenv("EKT_API_PASSWORD")
    if not user or not password:
        raise HTTPException(503, "Catalog credentials are not configured on the server")
    try:
        async with httpx.AsyncClient(
            auth=httpx.BasicAuth(user, password), timeout=10, follow_redirects=False
        ) as client:
            response = await client.get("https://ekt.kz/api/products" + path, params=params)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        code = 404 if exc.response.status_code == 404 else 502
        raise HTTPException(code, "Catalog is unavailable or product was not found") from None
    except (httpx.RequestError, ValueError):
        raise HTTPException(502, "Catalog is unavailable") from None


@app.get("/api/catalog", response_model=EktProductPage)
async def products(page: int = Query(1, ge=1, le=10000)) -> EktProductPage:
    try:
        return EktProductPage.model_validate(await upstream("", {"page": page}))
    except ValidationError:
        raise HTTPException(502, "Unexpected catalog response") from None


@app.get("/api/catalog/detail", response_model=EktDetailProduct)
async def product_detail(id: int = Query(ge=1)) -> EktDetailProduct:
    try:
        product = EktDetailProduct.model_validate(await upstream("/detail", {"id": id}))
    except ValidationError:
        raise HTTPException(502, "Unexpected product response") from None
    if product.id != id:
        raise HTTPException(502, "Unexpected product identifier")
    return product
