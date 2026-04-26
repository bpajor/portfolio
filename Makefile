.PHONY: dev-web build-web lint-web typecheck-web api mcp db-up db-down db-reset db-logs db-psql

dev-web:
	npm --workspace apps/web run dev

build-web:
	npm --workspace apps/web run build

lint-web:
	npm --workspace apps/web run lint

typecheck-web:
	npm --workspace apps/web run typecheck

api:
	cd apps/api && go run ./cmd/api

mcp:
	cd apps/mcp && go run ./cmd/mcp

db-up:
	docker compose -f compose.dev.yml up -d postgres

db-down:
	docker compose -f compose.dev.yml down

db-reset:
	powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev-db-reset.ps1

db-logs:
	docker compose -f compose.dev.yml logs -f postgres

db-psql:
	docker compose -f compose.dev.yml exec postgres psql -U portfolio -d portfolio
