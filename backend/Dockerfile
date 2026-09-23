FROM ghcr.io/astral-sh/uv:0.11.28 AS uv
FROM python:3.12-slim
COPY --from=uv /uv /uvx /bin/
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./backend/
RUN uv sync --directory backend --frozen --no-dev --no-install-project
COPY backend/app ./backend/app
COPY index.html ./index.html
COPY ["docs/source of truth/assets/products.json", "docs/source of truth/assets/products _page_2.json", "./docs/source of truth/assets/"]
RUN useradd --uid 10001 --no-create-home assistant
USER assistant
ENV PATH="/app/backend/.venv/bin:$PATH"
EXPOSE 8765
CMD ["uvicorn", "app.landing:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8765"]
