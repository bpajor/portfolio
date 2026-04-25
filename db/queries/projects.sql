-- name: ListFeaturedProjects :many
SELECT
    id,
    slug,
    title,
    eyebrow,
    summary,
    description,
    problem,
    built,
    signals,
    stack,
    repo_url,
    demo_url,
    sort_order,
    is_featured,
    created_at,
    updated_at
FROM projects
WHERE is_featured = true
ORDER BY sort_order ASC, created_at DESC;

-- name: GetProjectBySlug :one
SELECT
    id,
    slug,
    title,
    eyebrow,
    summary,
    description,
    problem,
    built,
    signals,
    stack,
    repo_url,
    demo_url,
    sort_order,
    is_featured,
    created_at,
    updated_at
FROM projects
WHERE slug = $1;

-- name: AdminListProjects :many
SELECT
    id,
    slug,
    title,
    eyebrow,
    summary,
    description,
    problem,
    built,
    signals,
    stack,
    repo_url,
    demo_url,
    sort_order,
    is_featured,
    created_at,
    updated_at
FROM projects
ORDER BY sort_order ASC, created_at DESC;

-- name: CreateProject :one
INSERT INTO projects (
    slug,
    title,
    eyebrow,
    summary,
    description,
    problem,
    built,
    signals,
    stack,
    repo_url,
    demo_url,
    sort_order,
    is_featured
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
)
RETURNING *;

-- name: UpdateProject :one
UPDATE projects
SET
    slug = $2,
    title = $3,
    eyebrow = $4,
    summary = $5,
    description = $6,
    problem = $7,
    built = $8,
    signals = $9,
    stack = $10,
    repo_url = $11,
    demo_url = $12,
    sort_order = $13,
    is_featured = $14,
    updated_at = now()
WHERE id = $1
RETURNING *;
