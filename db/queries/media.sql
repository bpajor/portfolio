-- name: CreateMedia :one
INSERT INTO media (
    filename,
    storage_path,
    mime_type,
    size_bytes,
    alt_text
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING *;

-- name: GetMedia :one
SELECT *
FROM media
WHERE id = $1;

-- name: AdminListMedia :many
SELECT *
FROM media
ORDER BY created_at DESC;
