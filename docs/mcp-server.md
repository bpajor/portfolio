# MCP Server

The MCP server runs as the Go service in `apps/mcp` and exposes streamable HTTP at:

```text
/mcp
```

Health check:

```text
GET /healthz
```

## Authentication

All MCP requests require a bearer token:

```text
Authorization: Bearer <token>
```

Primary token management is done from the admin app:

```text
/admin/mcp
```

Create a `read` token for read-only MCP clients and an `admin` token only for clients that should be allowed to call admin tools. The plaintext token is shown once on creation, then only its metadata remains visible. Revoking a token immediately removes access for future MCP requests.

Environment tokens remain a bootstrap/fallback path:

- `MCP_BEARER_TOKEN` for read-only tools.
- `MCP_ADMIN_BEARER_TOKEN` for admin tools.

Requests with an `Origin` header must match `MCP_ALLOWED_ORIGINS`.

## Tools

Read tools:

- `get_profile`
- `list_projects`
- `get_project`
- `list_blog_posts`
- `get_blog_post`
- `search_content`
- `get_site_context`

Admin tools:

- `create_draft_post`
- `moderate_comment`

Admin tool calls write to `audit_log`.

## Security Boundaries

The server does not expose shell execution, arbitrary file read, arbitrary file write, or generic SQL tools.
Admin tools are explicit and require the admin bearer token.

## Integration Test

With the local development database running:

```powershell
npm run dev:db:reset
$env:MCP_INTEGRATION_DATABASE_URL="postgres://portfolio:portfolio@127.0.0.1:55432/portfolio?sslmode=disable"
cd apps/mcp
..\..\.tools\go\bin\go.exe test ./internal/server -run TestSQLStoreIntegration -count=1
```

## Deployed Smoke Test

Use the smoke client after a staging deploy or through a trusted tunnel to the deployed stack. Generate the tokens from `/admin/mcp` for the target environment. Do not print or commit token values.

```powershell
$env:MCP_SMOKE_BASE_URL="https://staging-or-origin.example"
$env:MCP_SMOKE_READ_TOKEN="<MCP_BEARER_TOKEN>"
$env:MCP_SMOKE_ADMIN_TOKEN="<MCP_ADMIN_BEARER_TOKEN>"
cd apps/mcp
go run ./cmd/mcp-smoke
```

The smoke test verifies:

- `/mcp` rejects missing and invalid bearer tokens with `401`.
- The read token can initialize MCP, list expected read tools, and call `get_profile`.
- The read token cannot call `create_draft_post`.
- The admin token can initialize MCP and reaches admin-tool validation without creating a draft.
- Dangerous generic tools such as shell, arbitrary file read/write, and SQL query tools are not exposed.

The deploy workflow runs this against staging through the IAP-backed tunnel after the basic smoke checks and before the broader Playwright E2E suite. Production smoke keeps the public `/mcp` protection check and should not expose read/admin token values to public runners or logs.

## Manual MCP Inspector Check

Use the MCP Inspector or any streamable HTTP MCP client against the deployed endpoint:

```text
https://www.bpajor.dev/mcp
```

Set:

```text
Authorization: Bearer <token from /admin/mcp>
```

Expected behavior:

- Without a token, `/mcp` returns `401`.
- A `read` token can list and call read tools such as `get_profile`, `list_projects`, and `get_site_context`.
- A `read` token cannot use admin tools.
- An `admin` token can use explicit admin tools such as `create_draft_post`.
- After revocation in `/admin/mcp`, the same token no longer authenticates.
