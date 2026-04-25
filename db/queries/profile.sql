-- name: GetProfile :one
SELECT
    id,
    full_name,
    headline,
    short_bio,
    long_bio,
    location,
    current_company,
    focus_areas,
    skills,
    github_url,
    linkedin_url,
    email,
    profile_image_path,
    created_at,
    updated_at
FROM profile
WHERE id = 1;

-- name: UpdateProfile :one
UPDATE profile
SET
    full_name = $1,
    headline = $2,
    short_bio = $3,
    long_bio = $4,
    location = $5,
    current_company = $6,
    focus_areas = $7,
    skills = $8,
    github_url = $9,
    linkedin_url = $10,
    email = $11,
    profile_image_path = $12,
    updated_at = now()
WHERE id = 1
RETURNING *;
