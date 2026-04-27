# Testing

This project uses layered tests so small changes get fast feedback and production workflows can still be checked end to end.

## Frontend Unit Tests

```bash
npm run test:web
```

Coverage today focuses on SEO/GEO helpers, JSON-LD escaping, sitemap route generation, and structured data.

## Frontend E2E Tests

Install Playwright browsers once:

```bash
npx --workspace apps/web playwright install chromium
```

Run the smoke suite:

```bash
npm run test:e2e
```

The suite starts the Next.js dev server and checks public routes, crawler assets, and admin login gating.
To run the same suite against a deployed environment, set `E2E_BASE_URL`:

```bash
E2E_BASE_URL=https://staging.bpajor.dev npm run test:e2e
```

## Go API Tests

```bash
cd apps/api
go test ./...
```

The API suite includes auth, config, public route behavior, request body handling, and helper coverage.

Optional PostgreSQL integration test:

```powershell
$env:API_INTEGRATION_DATABASE_URL="postgres://portfolio:portfolio@127.0.0.1:55432/portfolio?sslmode=disable"
npm run dev:db:reset
cd apps/api
go test ./internal/httpserver -run Integration
```

## MCP Tests

```bash
cd apps/mcp
go test ./...
```

Optional PostgreSQL integration test:

```powershell
$env:MCP_INTEGRATION_DATABASE_URL="postgres://portfolio:portfolio@127.0.0.1:55432/portfolio?sslmode=disable"
npm run dev:db:reset
cd apps/mcp
go test ./internal/server -run Integration
```

## Migration Validation

```bash
npm run test:migrations
```

This starts a disposable local PostgreSQL container, applies the migration Up section, applies the Down section, and verifies the schema is removed.

On Windows, this depends on Docker Desktop and WSL being healthy. If Docker Compose hangs locally, run this layer in CI or after restarting Docker Desktop.
