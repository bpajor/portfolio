-- name: AdminListMCPTokens :many
SELECT id, name, token_hash, scope, created_by, created_at, last_used_at, revoked_at
FROM mcp_tokens
ORDER BY created_at DESC;

-- name: CreateMCPToken :one
INSERT INTO mcp_tokens (
    name,
    token_hash,
    scope,
    created_by
) VALUES (
    $1, $2, $3, $4
)
RETURNING id, name, token_hash, scope, created_by, created_at, last_used_at, revoked_at;

-- name: RevokeMCPToken :one
UPDATE mcp_tokens
SET revoked_at = now()
WHERE id = $1
  AND revoked_at IS NULL
RETURNING id, name, token_hash, scope, created_by, created_at, last_used_at, revoked_at;

-- name: GetActiveMCPTokenByHash :one
SELECT id, name, token_hash, scope, created_by, created_at, last_used_at, revoked_at
FROM mcp_tokens
WHERE token_hash = $1
  AND revoked_at IS NULL;

-- name: MarkMCPTokenUsed :exec
UPDATE mcp_tokens
SET last_used_at = now()
WHERE id = $1
  AND revoked_at IS NULL;
