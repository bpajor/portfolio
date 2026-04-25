-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin');
CREATE TYPE post_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE comment_status AS ENUM ('pending', 'approved', 'spam', 'deleted');
CREATE TYPE contact_message_status AS ENUM ('new', 'read', 'archived');

CREATE TABLE profile (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    full_name TEXT NOT NULL,
    headline TEXT NOT NULL,
    short_bio TEXT NOT NULL,
    long_bio TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    current_company TEXT NOT NULL DEFAULT '',
    focus_areas TEXT[] NOT NULL DEFAULT '{}',
    skills TEXT[] NOT NULL DEFAULT '{}',
    github_url TEXT NOT NULL,
    linkedin_url TEXT NOT NULL,
    email TEXT NOT NULL,
    profile_image_path TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT profile_singleton CHECK (id = 1)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    totp_secret_encrypted TEXT,
    role user_role NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    alt_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    eyebrow TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    problem TEXT NOT NULL DEFAULT '',
    built TEXT NOT NULL DEFAULT '',
    signals TEXT[] NOT NULL DEFAULT '{}',
    stack TEXT[] NOT NULL DEFAULT '{}',
    repo_url TEXT NOT NULL,
    demo_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    content_markdown TEXT NOT NULL DEFAULT '',
    content_html_sanitized TEXT NOT NULL DEFAULT '',
    status post_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    seo_title TEXT NOT NULL DEFAULT '',
    seo_description TEXT NOT NULL DEFAULT '',
    og_image_id UUID REFERENCES media(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT published_posts_need_date CHECK (
        status <> 'published' OR published_at IS NOT NULL
    )
);

CREATE TABLE post_tags (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (post_id, tag)
);

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    body TEXT NOT NULL,
    status comment_status NOT NULL DEFAULT 'pending',
    ip_hash TEXT NOT NULL DEFAULT '',
    user_agent_hash TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    moderated_at TIMESTAMPTZ,
    CONSTRAINT comments_display_name_not_blank CHECK (length(trim(display_name)) > 0),
    CONSTRAINT comments_body_not_blank CHECK (length(trim(body)) > 0)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    ip_hash TEXT NOT NULL DEFAULT '',
    user_agent_hash TEXT NOT NULL DEFAULT '',
    status contact_message_status NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT contact_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT contact_email_not_blank CHECK (length(trim(email)) > 0),
    CONSTRAINT contact_message_not_blank CHECK (length(trim(message)) > 0)
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_featured_sort ON projects (is_featured, sort_order, created_at DESC);
CREATE INDEX idx_posts_status_published_at ON posts (status, published_at DESC);
CREATE INDEX idx_post_tags_tag ON post_tags (tag);
CREATE INDEX idx_comments_post_status_created ON comments (post_id, status, created_at DESC);
CREATE INDEX idx_comments_status_created ON comments (status, created_at DESC);
CREATE INDEX idx_sessions_user_expires ON sessions (user_id, expires_at DESC);
CREATE INDEX idx_contact_messages_status_created ON contact_messages (status, created_at DESC);
CREATE INDEX idx_audit_log_created ON audit_log (created_at DESC);

INSERT INTO profile (
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
    profile_image_path
) VALUES (
    'Blazej Pajor',
    'Software Engineer for reliable backend and AI-driven systems',
    'Software Engineer working across backend development, cloud infrastructure, and AI-driven systems.',
    'I design, build, and maintain scalable systems using Go, PHP, Google Cloud Platform, and Kubernetes. My work focuses on reliability, performance optimization, and operating production cloud infrastructure. I am also expanding into LLM-based systems and Agentic AI, building automation and intelligent workflows with clear architecture and operational ownership.',
    'Poland / Remote',
    'WP Engine',
    ARRAY['Backend development', 'Cloud infrastructure', 'Agentic AI'],
    ARRAY['Go', 'PHP', 'Google Cloud Platform', 'Kubernetes', 'PostgreSQL', 'LLM systems', 'MCP'],
    'https://github.com/bpajor/',
    'https://www.linkedin.com/in/b%C5%82a%C5%BCej-pajor-837974238/',
    'blazej122@vp.pl',
    '/images/profile.jpg'
);

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
    sort_order
) VALUES
(
    'pay-management-system',
    'Pay Management System',
    'Business operations',
    'A system for monitoring employee payouts and keeping payroll-related workflows visible to internal users.',
    'A business application for monitoring employee payouts and operational payroll workflows.',
    'Payroll visibility usually breaks down when calculations, approvals, and operational status live in separate places.',
    'Designed an application surface for tracking payout state, business rules, and operational review paths.',
    ARRAY['Domain modeling', 'Workflow state', 'Admin-facing UX'],
    ARRAY['Backend', 'Business logic', 'Internal tooling'],
    'https://github.com/bpajor/pay-man-sys',
    10
),
(
    'pol-elections-2023-rest-api',
    'PolElections2023 REST API',
    'Public data API',
    'A REST API exposing Polish parliamentary election results from 2023 through structured endpoints.',
    'An API exposing Polish parliamentary election data with authenticated access patterns.',
    'Election data is useful only when it can be queried predictably by district, committee, candidate, and result scope.',
    'Implemented an authenticated API layer for exploring election results and related entities through clear REST contracts.',
    ARRAY['API design', 'JWT auth', 'Structured public data'],
    ARRAY['Nest.js', 'TypeScript', 'Mongoose', 'JWT'],
    'https://github.com/bpajor/PolElections2023-rest-api',
    20
);

-- +goose Down
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS contact_messages;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS post_tags;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS profile;

DROP TYPE IF EXISTS contact_message_status;
DROP TYPE IF EXISTS comment_status;
DROP TYPE IF EXISTS post_status;
DROP TYPE IF EXISTS user_role;
