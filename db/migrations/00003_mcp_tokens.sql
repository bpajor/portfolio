-- +goose Up
CREATE TYPE mcp_token_scope AS ENUM ('read', 'admin');

CREATE TABLE mcp_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scope mcp_token_scope NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT mcp_tokens_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_mcp_tokens_active_scope ON mcp_tokens (scope, created_at DESC)
WHERE revoked_at IS NULL;

CREATE INDEX idx_mcp_tokens_created_at ON mcp_tokens (created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS mcp_tokens;
DROP TYPE IF EXISTS mcp_token_scope;
