# Hackalem AI 2026 — краткая карта проекта

Временный файл до появления PRD. Официальные требования пока не заполнены:
`docs/source of truth/PRD.md`, `use-cases.md`, `plan.md` — пустые.

## 1. Как проходит запрос

```text
Next.js UI
  -> /api/* proxy (cookies/auth)
  -> FastAPI route /api/v1/*
  -> Service (бизнес-логика)
  -> Repository (SQL-запросы)
  -> PostgreSQL
```

Для AI-чата отдельный путь:

```text
Frontend useChat
  -> WebSocket /api/v1/ws/agent
  -> AgentSession
  -> PydanticAI AssistantAgent
  -> tools: RAG / web / code / charts / MCP
  -> streaming events обратно в UI
  -> conversation/message сохраняются в DB
```

## 2. Что где лежит

### Backend (`backend/app`)

- `main.py` — создание FastAPI, startup/shutdown, Redis, embeddings, vector store.
- `api/routes/v1/` — HTTP/WebSocket endpoints; здесь не писать SQL.
- `api/deps.py` — dependency injection: DB, current user, services.
- `schemas/` — Pydantic-контракты входа/выхода API.
- `services/` — бизнес-логика и orchestration.
- `repositories/` — доступ к PostgreSQL; использовать `flush()`, не `commit()`.
- `db/models/` — SQLAlchemy-модели и связи.
- `agents/` — AI-агент, prompts и tools.
- `services/rag/` — embeddings, ingestion, pgvector search, sync connectors.
- `commands/` — CLI-команды, автообнаруживаются через `cmd`.
- `worker/background/` — фоновые задачи.

### Frontend (`frontend/src`)

- `app/[locale]/` — страницы Next.js; `(dashboard)` — авторизованная часть.
- `app/api/` — server-side proxy к FastAPI, передаёт auth cookies.
- `components/` — UI и chat-компоненты.
- `hooks/` — сценарии UI (`useChat`, auth, conversations).
- `stores/` — Zustand state.
- `lib/api-client.ts` — единый HTTP-клиент и refresh при 401.
- `messages/` — переводы i18n.

## 3. Готовые кирпичики boilerplate

- JWT + refresh tokens, API key, роли user/admin.
- PostgreSQL + Alembic migrations.
- Redis cache.
- Chat через WebSocket со streaming, остановкой ответа и human-in-the-loop `ask_user`.
- Сохранение conversations/messages и загрузка файлов.
- RAG: ingestion, embeddings, pgvector, semantic search.
- AI tools: web search/fetch, RAG, Python/code execution, charts, MCP.
- Docker Compose, Makefile, pytest, Ruff, frontend tests.

## 4. Как добавлять фичу после PRD

1. Найти/описать UC и observable result: что ввёл пользователь и какой результат проверяем.
2. Сначала добавить падающий E2E/API тест (Red).
3. Для обычной CRUD-фичи: `model -> migration -> schema -> repository -> service -> route -> UI`.
4. Для AI-фичи: определить tool/данные/ограничения, подключить в `agents/`, провести через `AgentSession`.
5. Добавить frontend hook/store/component и связать с реальным endpoint/WebSocket.
6. Проверить результат тестом и живым прогоном; только потом обновить `ROADMAP.md`/`CHANGELOG.md`.

## 5. Быстрый запуск

```bash
make bootstrap                 # первый запуск: Docker + migrations + admin
make dev                       # backend stack, повторный запуск
make dev-frontend              # frontend Docker
cd frontend && bun dev         # frontend локально вместо Docker
make test                      # backend tests
make lint                      # Ruff + type check
make db-upgrade                # применить migrations
```

Проверки после запуска: API `http://localhost:8000`, Swagger `/docs`, UI `http://localhost:3000`.
Для AI нужны корректные `backend/.env` и `OPENAI_API_KEY`.

## 6. Что ждём от PRD

После получения PRD надо выбрать один главный UC, зафиксировать input/output/ошибки/confirmation,
связать его с существующим chat или CRUD-путём и сделать первый тонкий E2E: UI → API/WS → processing → проверяемый результат.
