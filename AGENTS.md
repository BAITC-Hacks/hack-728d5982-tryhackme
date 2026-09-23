# AGENTS.md

This file provides guidance for AI coding agents (Codex, Copilot, Cursor, Zed, OpenCode).

## Development from the user outcome

The goal is to have working scenarios from the PRD: user input → actual processing → verifiable outcome. Any change should help the scenario or eliminate a specific obstacle to it.

### Sources of truth

- `PRD.md`: product goal, MVP boundaries, and three key use cases with identifiers UC-01…03. For each: input, expected outcome, acceptance criteria, and necessary exceptions, including human confirmation.
- `plan.md`: human decisions regarding the stack, architecture, and constraints. Do not modify without an explicit request. If a decision conflicts with the requirements, explain the conflict.
- Golden dataset: input examples and result benchmarks related to the UC. Use the existing `output/` and `evals/`; do not duplicate data. The benchmark illustrates the requirements but does not cover all valid inputs.
- `ROADMAP.md`: current implementation steps linked to the UC and the verifiable result of each step.
- `CHANGELOG.md`: significant completed changes, the corresponding UC, and the verification method.

Don’t create folders and documents in advance. If the scenarios are already described in the PRD, separate `use-cases` are needed only when the volume grows. Requirements define the behavior; the roadmap and tests must correspond to it. Identify contradictions; don’t adjust the requirements to fit the implementation.

### Work procedure

1. Read the requirements, constraints, and the current roadmap step that are relevant to the request. Complete the user’s task; if asked to continue, proceed to the next relevant step.
2. Define the UC, inputs, and success criterion. To change the behavior, first add a check that fails for the expected reason (Red).
3. Implement the minimum solution that passes the check (Green). Improve the structure only when necessary, preserving the result (Refactor).
4. Test the affected scenario. Update the roadmap and changelog based on the actual result; do not mark anything unconfirmed as completed.
5. Briefly report: What now works, as verified, what limitations remain.

Start with a thin end‑to‑end scenario: minimal UI → API → real processing → result. The UI can be shown first with mocks, but then connect the real processing. Phase 0 includes only the necessary foundation for this; the following steps are refined based on the results of the run.

### Architecture and contracts

- Use the stack from `plan.md`. The default option in the absence of another solution: Next.js, Tailwind/shadcn for UI; Python, FastAPI and Pydantic for API. DB, authorization, streaming and agent SDK are added as needed by the scenario.
- First, define the data processing. A regular function, an LLM call and a standalone agent are different implementation options. Several agents are needed for specific use cases; the number and roles are not fixed by a template.
- Inputs, outputs, errors and states are derived from the UC. For Python APIs, Pydantic schemas serve as the source of OpenAPI; client types are generated from it. Do not maintain independent copies manually.
- Add one command to verify the validity of the generated contracts and use it locally and in CI. Schema matching does not replace behavior verification.
- Do not add infrastructure “for the future” and do not rewrite working code for the sake of aesthetics. The change does not have to affect all layers, but its connection to the scenario must be clear.

### Verification and readiness

- Playwright checks the user journey and the availability of the result, not just the presence of DOM elements.
- pytest with async/httpx, if necessary, checks the API, data processing, and state transitions, not just the HTTP code and JSON format.
- Numbers, required fields, thresholds, and human confirmation conditions are checked programmatically. The LLM judge is used for semantic evaluation based on explicit criteria; its verdict is not the sole evidence.
- Compare the result with the requirements and essential facts of the benchmark. Literal or byte‑by‑byte matching is required only if such a requirement exists. Add input variations and edge cases where they test a specific risk.
- Choose checks based on changes: don’t run all levels for every edit. Before declaring the MVP ready, perform real end‑to‑end runs of all three UCs and check their acceptance criteria.
- Mocks are acceptable for UI and isolated tests; they must be clearly marked. It is forbidden to substitute reference answers into the working business logic or to pass off a mock run as a live one. If integration is not available, indicate what remains unchecked.

### How to develop these instructions

Add a rule after a recurring error or when there is a known high‑risk issue. Product examples, detailed code, dependency versions, and current milestones are stored in the corresponding project files. Remove outdated and duplicate rules; keep the instructions short and applicable..


## Project Overview

**hackalem_ai_project_tryhackme** - FastAPI application generated with [Full-Stack AI Agent Template](https://github.com/vstorm-co/full-stack-ai-agent-template).

**Stack:** FastAPI + Pydantic v2, PostgreSQL
, JWT + API Key auth, Redis
, pydantic_ai (openai), RAG (pgvector), Next.js 15 (i18n)

## Commands

```bash
# Run server
cd backend && uv run uvicorn app.main:app --reload

# Tests & lint
pytest
ruff check . --fix && ruff format .

# Migrations
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "Description"

# RAG
uv run hackalem_ai_project_tryhackme rag-ingest /path/to/file.pdf --collection docs
uv run hackalem_ai_project_tryhackme rag-search "query" --collection docs

# Sync Sources
uv run hackalem_ai_project_tryhackme cmd rag-sources
uv run hackalem_ai_project_tryhackme cmd rag-source-add
uv run hackalem_ai_project_tryhackme cmd rag-source-sync
```

## Project Structure

```
backend/app/
├── api/routes/v1/    # Endpoints
├── services/         # Business logic
├── repositories/     # Data access
├── schemas/          # Pydantic models
├── db/models/        # DB models
├── agents/           # AI agents
├── rag/              # RAG (embeddings, vector store, ingestion)
│   └── connectors/   # Sync source connectors
└── commands/         # CLI commands
```

## Key Conventions

- `db.flush()` in repositories, not `commit()`
- Services raise `NotFoundError`, `AlreadyExistsError`
- Separate `Create`, `Update`, `Response` schemas
- Commands auto-discovered from `app/commands/`
- Document ingestion via CLI and API upload
- Sync sources: configurable connectors with scheduled sync

## More Info

- `docs/architecture.md` - Architecture details
- `docs/adding_features.md` - How to add features
- `docs/testing.md` - Testing guide
- `docs/patterns.md` - Code patterns
