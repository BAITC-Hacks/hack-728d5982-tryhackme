.PHONY: install dev dev-frontend check test test-ui test-live test-files-live contracts examples build-frontend docker

install:
	uv sync --directory backend
	npm --prefix frontend ci

dev:
	cd backend && uv run uvicorn app.landing:app --host 127.0.0.1 --port 8765 --reload

dev-frontend:
	npm --prefix frontend run dev

contracts:
	cd backend && uv run python generate_ekt_catalog_openapi.py --check
	cd backend && uv run python generate_landing_openapi.py --check

check: contracts
	cd backend && uv run ruff check app tests generate_ekt_catalog_openapi.py generate_landing_openapi.py
	cd backend && uv run ruff format app tests generate_ekt_catalog_openapi.py generate_landing_openapi.py --check
	cd backend && uv run ty check
	npm --prefix frontend run lint
	npm --prefix frontend run type-check

test:
	cd backend && uv run pytest

test-ui:
	npm --prefix frontend run test:landing

test-live:
	npm --prefix frontend run test:landing:live

test-files-live:
	uv run --directory backend python ../out/verify_live.py

examples:
	uv run --directory backend python ../out/generate_examples.py

build-frontend:
	npm --prefix frontend run build

docker:
	docker compose up --build
