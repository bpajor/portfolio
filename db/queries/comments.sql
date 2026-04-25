-- name: ListApprovedCommentsForPost :many
SELECT
    id,
    post_id,
    display_name,
    body,
    status,
    created_at
FROM comments
WHERE post_id = $1
  AND status = 'approved'
ORDER BY created_at ASC;

-- name: CreatePendingComment :one
INSERT INTO comments (
    post_id,
    display_name,
    body,
    ip_hash,
    user_agent_hash
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING id, post_id, display_name, body, status, created_at;

-- name: AdminListComments :many
SELECT
    c.id,
    c.post_id,
    p.title AS post_title,
    p.slug AS post_slug,
    c.display_name,
    c.body,
    c.status,
    c.created_at,
    c.moderated_at
FROM comments c
JOIN posts p ON p.id = c.post_id
WHERE sqlc.narg('status')::comment_status IS NULL
   OR c.status = sqlc.narg('status')::comment_status
ORDER BY c.created_at DESC;

-- name: ModerateComment :one
UPDATE comments
SET
    status = $2,
    moderated_at = now()
WHERE id = $1
RETURNING *;
