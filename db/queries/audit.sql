-- name: CreateAuditLog :one
INSERT INTO audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING *;

-- name: AdminListAuditLog :many
SELECT *
FROM audit_log
ORDER BY created_at DESC
LIMIT $1
OFFSET $2;
