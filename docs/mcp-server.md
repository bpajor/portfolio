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

Tokens:

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
