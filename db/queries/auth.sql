-- name: GetUserByEmail :one
SELECT
    id,
    email,
    password_hash,
    totp_secret_encrypted,
    role,
    created_at,
    updated_at,
    last_login_at
FROM users
WHERE email = $1;

-- name: CreateAdminUser :one
INSERT INTO users (
    email,
    password_hash,
    totp_secret_encrypted
) VALUES (
    $1, $2, $3
)
RETURNING id, email, role, created_at, updated_at, last_login_at;

-- name: UpdateUserLastLogin :exec
UPDATE users
SET last_login_at = now(), updated_at = now()
WHERE id = $1;

-- name: CreateSession :one
INSERT INTO sessions (
    user_id,
    token_hash,
    expires_at
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: GetSessionByTokenHash :one
SELECT
    s.id,
    s.user_id,
    s.token_hash,
    s.expires_at,
    s.created_at,
    s.revoked_at,
    u.email,
    u.role
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = $1
  AND s.expires_at > now()
  AND s.revoked_at IS NULL;

-- name: RevokeSession :exec
UPDATE sessions
SET revoked_at = now()
WHERE token_hash = $1
  AND revoked_at IS NULL;
