.PHONY: dev-web build-web lint-web typecheck-web api mcp

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
