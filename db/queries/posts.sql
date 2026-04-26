-- name: ListPublishedPosts :many
SELECT
    p.id,
    p.slug,
    p.title,
    p.excerpt,
    p.status,
    p.published_at,
    p.seo_title,
    p.seo_description,
    p.created_at,
    p.updated_at,
    COALESCE(array_agg(pt.tag ORDER BY pt.tag) FILTER (WHERE pt.tag IS NOT NULL), '{}')::text[] AS tags
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
WHERE p.status = 'published'
GROUP BY p.id
ORDER BY p.published_at DESC;

-- name: GetPublishedPostBySlug :one
SELECT
    p.id,
    p.slug,
    p.title,
    p.excerpt,
    p.content_markdown,
    p.content_html_sanitized,
    p.status,
    p.published_at,
    p.seo_title,
    p.seo_description,
    p.created_at,
    p.updated_at,
    COALESCE(array_agg(pt.tag ORDER BY pt.tag) FILTER (WHERE pt.tag IS NOT NULL), '{}')::text[] AS tags
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
WHERE p.slug = $1
  AND p.status = 'published'
GROUP BY p.id;

-- name: AdminListPosts :many
SELECT
    id,
    slug,
    title,
    excerpt,
    status,
    published_at,
    seo_title,
    seo_description,
    created_at,
    updated_at
FROM posts
ORDER BY created_at DESC;

-- name: AdminGetPost :one
SELECT
    id,
    slug,
    title,
    excerpt,
    content_markdown,
    content_html_sanitized,
    status,
    published_at,
    author_id,
    seo_title,
    seo_description,
    og_image_id,
    created_at,
    updated_at
FROM posts
WHERE id = $1;

-- name: CreatePost :one
INSERT INTO posts (
    slug,
    title,
    excerpt,
    content_markdown,
    content_html_sanitized,
    status,
    published_at,
    author_id,
    seo_title,
    seo_description,
    og_image_id
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
RETURNING *;

-- name: UpdatePost :one
UPDATE posts
SET
    slug = $2,
    title = $3,
    excerpt = $4,
    content_markdown = $5,
    content_html_sanitized = $6,
    status = $7,
    published_at = $8,
    seo_title = $9,
    seo_description = $10,
    og_image_id = $11,
    updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeletePost :exec
DELETE FROM posts
WHERE id = $1;

-- name: DeletePostTags :exec
DELETE FROM post_tags
WHERE post_id = $1;

-- name: AddPostTags :exec
INSERT INTO post_tags (post_id, tag)
SELECT $1, unnest(sqlc.arg(tags)::text[])
ON CONFLICT DO NOTHING;
