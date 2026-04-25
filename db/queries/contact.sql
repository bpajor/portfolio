-- name: CreateContactMessage :one
INSERT INTO contact_messages (
    name,
    email,
    message,
    ip_hash,
    user_agent_hash
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING id, name, email, message, status, created_at;

-- name: AdminListContactMessages :many
SELECT
    id,
    name,
    email,
    message,
    status,
    created_at
FROM contact_messages
WHERE sqlc.narg('status')::contact_message_status IS NULL
   OR status = sqlc.narg('status')::contact_message_status
ORDER BY created_at DESC;

-- name: UpdateContactMessageStatus :one
UPDATE contact_messages
SET status = $2
WHERE id = $1
RETURNING id, name, email, message, status, created_at;
