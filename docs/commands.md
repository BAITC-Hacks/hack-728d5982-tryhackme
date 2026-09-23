# Commands Reference

This project provides commands via two interfaces: **Make** targets for common
workflows and a **project CLI** for fine-grained control.

## Make Commands

Run these from the project root directory.

### Quick Start

| Command | Description |
|---------|-------------|
| `make quickstart` | Install deps, start Docker, run migrations, create admin user |
| `make install` | Install backend dependencies with uv + pre-commit hooks |

### Development

| Command | Description |
|---------|-------------|
| `make run` | Start development server with hot reload |
| `make run-prod` | Start production server (0.0.0.0:8000) |
| `make routes` | Show all registered API routes |
| `make test` | Run tests with verbose output |
| `make test-cov` | Run tests with coverage report (HTML + terminal) |
| `make format` | Auto-format code with ruff |
| `make lint` | Lint and type-check code (ruff + ty) |
| `make clean` | Remove cache files (__pycache__, .pytest_cache, etc.) |


### Database

| Command | Description |
|---------|-------------|
| `make db-init` | Start PostgreSQL + create initial migration + apply |
| `make db-migrate` | Create new migration (prompts for message) |
| `make db-upgrade` | Apply pending migrations |
| `make db-downgrade` | Rollback last migration |
| `make db-current` | Show current migration revision |
| `make db-history` | Show full migration history |

### Users

| Command | Description |
|---------|-------------|
| `make create-admin` | Create admin user (interactive) |
| `make user-create` | Create new user (interactive) |
| `make user-list` | List all users |

### Docker (Development)

| Command | Description |
|---------|-------------|
| `make docker-up` | Start all backend services |
| `make docker-down` | Stop all services |
| `make docker-logs` | Follow backend logs |
| `make docker-build` | Build backend images |
| `make docker-shell` | Open shell in app container |
| `make docker-frontend` | Start frontend (separate compose) |
| `make docker-frontend-down` | Stop frontend |
| `make docker-frontend-logs` | Follow frontend logs |
| `make docker-frontend-build` | Build frontend image |
| `make docker-db` | Start only PostgreSQL |
| `make docker-db-stop` | Stop PostgreSQL |
| `make docker-redis` | Start only Redis |
| `make docker-redis-stop` | Stop Redis |

### Docker (Production with Traefik)

| Command | Description |
|---------|-------------|
| `make docker-prod` | Start production stack |
| `make docker-prod-down` | Stop production stack |
| `make docker-prod-logs` | Follow production logs |
| `make docker-prod-build` | Build production images |

### Vercel (Frontend Deployment)

| Command | Description |
|---------|-------------|
| `make vercel-deploy` | Deploy frontend to Vercel |

---

## Project CLI

All project CLI commands are invoked via:

```bash
cd backend
uv run hackalem_ai_project_tryhackme <group> <command> [options]
```

### Server Commands

```bash
uv run hackalem_ai_project_tryhackme server run              # Start dev server
uv run hackalem_ai_project_tryhackme server run --reload     # With hot reload
uv run hackalem_ai_project_tryhackme server run --port 9000  # Custom port
uv run hackalem_ai_project_tryhackme server routes           # Show all registered routes
```


### Database Commands

```bash
uv run hackalem_ai_project_tryhackme db init                  # Run all migrations
uv run hackalem_ai_project_tryhackme db migrate -m "message"  # Create new migration
uv run hackalem_ai_project_tryhackme db upgrade               # Apply pending migrations
uv run hackalem_ai_project_tryhackme db upgrade --revision e3f  # Upgrade to specific revision
uv run hackalem_ai_project_tryhackme db downgrade             # Rollback last migration
uv run hackalem_ai_project_tryhackme db downgrade --revision base  # Rollback to start
uv run hackalem_ai_project_tryhackme db current               # Show current revision
uv run hackalem_ai_project_tryhackme db history               # Show migration history
```

### User Commands

```bash
# Create user (interactive prompts for email/password)
uv run hackalem_ai_project_tryhackme user create

# Create user non-interactively
uv run hackalem_ai_project_tryhackme user create --email user@example.com --password secret

# Create user with specific role
uv run hackalem_ai_project_tryhackme user create --email admin@example.com --password secret --role admin

# Create user with superuser flag
uv run hackalem_ai_project_tryhackme user create --email admin@example.com --password secret --superuser

# Create admin (shortcut)
uv run hackalem_ai_project_tryhackme user create-admin --email admin@example.com --password secret

# Change user role
uv run hackalem_ai_project_tryhackme user set-role user@example.com --role admin

# List all users
uv run hackalem_ai_project_tryhackme user list
```

### Custom Commands

Custom commands are auto-discovered from `app/commands/`. Run them via:

```bash
uv run hackalem_ai_project_tryhackme cmd <command-name> [options]
```

### RAG Commands

All RAG commands are custom commands invoked via `cmd`:

#### Document Ingestion

```bash
# Ingest a single file
uv run hackalem_ai_project_tryhackme cmd rag-ingest ./docs/guide.pdf

# Ingest a directory
uv run hackalem_ai_project_tryhackme cmd rag-ingest ./docs/

# Ingest recursively into a specific collection
uv run hackalem_ai_project_tryhackme cmd rag-ingest ./docs/ --collection knowledge --recursive

# Ingest with sync mode
uv run hackalem_ai_project_tryhackme cmd rag-ingest ./docs/ --sync-mode new_only
uv run hackalem_ai_project_tryhackme cmd rag-ingest ./docs/ --sync-mode update_only

# Skip replacing existing documents
uv run hackalem_ai_project_tryhackme cmd rag-ingest ./docs/ --no-replace
```

#### Search

```bash
# Search the default collection
uv run hackalem_ai_project_tryhackme cmd rag-search "what is fastapi"

# Search a specific collection
uv run hackalem_ai_project_tryhackme cmd rag-search "deployment guide" --collection docs

# Get more results
uv run hackalem_ai_project_tryhackme cmd rag-search "deployment" --top-k 10
```

#### Collection Management

```bash
# List all collections with stats
uv run hackalem_ai_project_tryhackme cmd rag-collections

# Show overall RAG system statistics
uv run hackalem_ai_project_tryhackme cmd rag-stats

# Drop a collection (with confirmation)
uv run hackalem_ai_project_tryhackme cmd rag-drop my_collection

# Drop without confirmation
uv run hackalem_ai_project_tryhackme cmd rag-drop my_collection --yes
```


#### Sync Source Management

```bash
# List configured sync sources
uv run hackalem_ai_project_tryhackme cmd rag-sources

# Add a new sync source
uv run hackalem_ai_project_tryhackme cmd rag-source-add \
    --name "My Drive" \
    --type gdrive \
    --collection docs \
    --config '{"folder_id": "abc123"}' \
    --sync-mode new_only \
    --schedule 60

# Remove a sync source
uv run hackalem_ai_project_tryhackme cmd rag-source-remove <source-id>
uv run hackalem_ai_project_tryhackme cmd rag-source-remove <source-id> --yes  # Skip confirmation

# Trigger sync for a specific source
uv run hackalem_ai_project_tryhackme cmd rag-source-sync <source-id>

# Trigger sync for all active sources
uv run hackalem_ai_project_tryhackme cmd rag-source-sync --all
```

## Adding Custom Commands

Commands are auto-discovered from `app/commands/`. Create a new file:

```python
# app/commands/my_command.py
import click
from app.commands import command, success, error

@command("my-command", help="Description of what this does")
@click.option("--name", "-n", required=True, help="Name parameter")
def my_command(name: str):
    """Your command logic here."""
    success(f"Done: {name}")
```

Run it:

```bash
uv run hackalem_ai_project_tryhackme cmd my-command --name test
```

For more details, see `docs/adding_features.md`.
