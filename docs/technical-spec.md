# Portfolio and Blog Platform Technical Specification

## 1. Product Goal

Build a personal portfolio and publishing platform for Blazej Pajor, Software Engineer focused on backend engineering, GCP, Kubernetes, reliability, and AI systems.

The site should:

- present professional identity and selected projects,
- publish technical blog posts from an admin panel,
- allow anonymous comments with moderation,
- expose a secure MCP server for AI agents,
- be optimized for SEO and Generative Engine Optimization,
- run on GCP within a target budget of 50 PLN per month.

Primary language: English.

Visual direction: dark, technical, engineering-focused.

## 2. High-Level Architecture

```text
Visitor / AI crawler / MCP client
        |
        v
Cloudflare Free
  - DNS
  - proxy
  - cache
  - basic DDoS protection
  - Turnstile
        |
        v
GCP Compute Engine e2-micro
        |
        v
Caddy reverse proxy
  - HTTPS
  - security headers
  - route protection
        |
        +--> Next.js web app
        +--> Go API
        +--> Go MCP server
        +--> PostgreSQL private container
```

Recommended deployment for V1: a single small VM running Docker Compose. This keeps monthly cost low and avoids Cloud SQL cost until traffic or operational needs justify migration.

## 3. Technology Stack

### Frontend

- Next.js with TypeScript.
- Tailwind CSS.
- Server-side rendering or static generation for public pages.
- React Query or native fetch layer for admin/API interactions.
- Dark technical UI.

### Backend API

- Go.
- `net/http` with `chi` router.
- `pgx` for PostgreSQL access.
- `sqlc` for typed SQL query generation.
- `goose` for migrations.
- `zap` or `slog` for structured logging.
- `golangci-lint` for quality gates.

### MCP Server

- Go.
- Official MCP Go SDK: `github.com/modelcontextprotocol/go-sdk`.
- Streamable HTTP transport for remote agent access.
- Bearer token or Cloudflare Access for V1 authentication.
- Read-only tools public only if explicitly enabled.
- Admin tools require elevated token.

### Database

- PostgreSQL in a Docker container on the VM.
- No public database port.
- Daily encrypted backup dump to Cloud Storage.

### Infrastructure

- GCP Compute Engine `e2-micro` in a free-tier-eligible US region.
- Persistent Disk around 30 GB.
- Cloud Storage bucket for backups.
- GCP firewall with only 80/443 open publicly.
- SSH restricted to owner IP or IAP when possible.
- Cloudflare DNS and proxy.

### Testing

- Go unit tests with the standard `testing` package.
- Go HTTP handler tests with `httptest`.
- PostgreSQL integration tests with disposable containers or a dedicated CI service container.
- SQL migration tests against PostgreSQL before deployment.
- Frontend unit/component tests where behavior is non-trivial.
- Playwright E2E tests for browser flows.
- Smoke tests against deployed staging and production health endpoints.

### CI/CD

- GitHub Actions for pull request and main branch pipelines.
- GitHub protected environments for staging and production.
- Staging deployment runs automatically after CI succeeds on `main`.
- Production deployment requires manual developer approval after staging smoke/E2E checks pass.
- CI uses environment-scoped secrets only; production secrets are not available to pull request workflows.

## 4. Repository Structure

```text
apps/
  web/                  # Next.js frontend and admin UI
  api/                  # Go REST API
  mcp/                  # Go MCP server
packages/
  shared/               # Shared TS types if needed
db/
  migrations/           # Goose migrations
  queries/              # sqlc query files
infra/
  docker/
  gcp/
deploy/
  compose/
docs/
  technical-spec.md
  codex-development-workflow.md
.agent/
  prd/
  tasks/
  tasks.json
```

## 5. Core Domain Model

### profile

Single public professional profile used by the website API and MCP tools.

Fields:

- `id`
- `full_name`
- `headline`
- `short_bio`
- `long_bio`
- `location`
- `current_company`
- `focus_areas`
- `skills`
- `github_url`
- `linkedin_url`
- `email`
- `profile_image_path`
- `created_at`
- `updated_at`

### users

Admin-only users.

Fields:

- `id`
- `email`
- `password_hash`
- `totp_secret_encrypted`
- `role`
- `created_at`
- `updated_at`
- `last_login_at`

### posts

Blog posts created in the admin panel.

Fields:

- `id`
- `slug`
- `title`
- `excerpt`
- `content_markdown`
- `content_html_sanitized`
- `status`: `draft`, `published`, `archived`
- `published_at`
- `author_id`
- `seo_title`
- `seo_description`
- `og_image_id`
- `created_at`
- `updated_at`

### comments

Anonymous comments on blog posts.

Fields:

- `id`
- `post_id`
- `display_name`
- `body`
- `status`: `pending`, `approved`, `spam`, `deleted`
- `ip_hash`
- `user_agent_hash`
- `created_at`
- `moderated_at`

### projects

Portfolio projects.

Seed data:

- Pay Management System: `https://github.com/bpajor/pay-man-sys`
- PolElections2023 REST API: `https://github.com/bpajor/PolElections2023-rest-api`

Fields:

- `id`
- `slug`
- `title`
- `summary`
- `description`
- `stack`
- `repo_url`
- `demo_url`
- `sort_order`
- `created_at`
- `updated_at`

### media

Uploaded images and assets.

Fields:

- `id`
- `filename`
- `storage_path`
- `mime_type`
- `size_bytes`
- `alt_text`
- `created_at`

### contact_messages

Messages from public contact form.

Fields:

- `id`
- `name`
- `email`
- `message`
- `ip_hash`
- `user_agent_hash`
- `status`
- `created_at`

## 6. Public Pages

- `/`
  - hero with profile image,
  - concise positioning,
  - featured projects,
  - latest posts,
  - contact CTA.
- `/about`
  - detailed professional bio,
  - skills and focus areas.
- `/projects`
  - project index.
- `/projects/[slug]`
  - project detail page.
- `/blog`
  - post index.
- `/blog/[slug]`
  - article, comments, related posts.
- `/contact`
  - contact information and form.

## 7. Admin Pages

- `/admin/login`
- `/admin`
- `/admin/posts`
- `/admin/posts/new`
- `/admin/posts/[id]`
- `/admin/comments`
- `/admin/projects`
- `/admin/media`
- `/admin/settings`

Admin requirements:

- session cookie with `HttpOnly`, `Secure`, `SameSite=Lax`,
- password hashing with Argon2id or bcrypt,
- optional TOTP MFA,
- rate-limited login,
- audit log for destructive actions.

## 8. Go API Design

Public endpoints:

- `GET /api/healthz`
- `GET /api/profile`
- `GET /api/projects`
- `GET /api/projects/{slug}`
- `GET /api/posts`
- `GET /api/posts/{slug}`
- `POST /api/posts/{slug}/comments`
- `POST /api/contact`

Admin endpoints:

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/me`
- `POST /api/admin/posts`
- `PUT /api/admin/posts/{id}`
- `DELETE /api/admin/posts/{id}`
- `GET /api/admin/comments`
- `PUT /api/admin/comments/{id}/moderate`
- `POST /api/admin/projects`
- `PUT /api/admin/projects/{id}`
- `POST /api/admin/media`

Security middleware:

- request ID,
- structured logs,
- panic recovery,
- CORS allowlist,
- CSRF for cookie-auth admin actions,
- rate limits by route,
- request body size limits,
- secure response headers at Caddy and app layer.

## 9. MCP Server

Endpoint:

- `/mcp`

Initial tools:

- `get_profile`
  - returns concise professional profile.
- `list_projects`
  - returns portfolio projects.
- `get_project`
  - returns project detail by slug.
- `list_blog_posts`
  - returns published posts.
- `get_blog_post`
  - returns published post content.
- `search_content`
  - searches profile, projects, and published posts.
- `get_site_context`
  - returns compact context block for agents.
- `create_draft_post`
  - admin-only.
- `moderate_comment`
  - admin-only.

MCP security policy:

- no shell execution tools,
- no arbitrary file read/write tools,
- no generic SQL execution tool,
- tool-level authorization,
- strict input schemas,
- audit all write/admin tool calls,
- validate `Origin` for HTTP transport,
- require `Authorization: Bearer <token>`,
- short-lived tokens when possible,
- Cloudflare Access preferred for remote private usage.

## 10. SEO and GEO Strategy

GEO here means Generative Engine Optimization: making the content easy for search engines and AI systems to understand, cite, and summarize.

Principles:

- no hidden keyword stuffing,
- content should be useful to humans first,
- important content must be rendered as text in HTML,
- metadata must match visible content,
- blog posts should have clear headings, answer-first introductions, and precise claims.

Technical SEO:

- `sitemap.xml`,
- `robots.txt`,
- `rss.xml`,
- canonical URLs,
- OpenGraph metadata,
- Twitter card metadata,
- clean semantic HTML,
- good Core Web Vitals,
- image alt text,
- structured internal links.

Structured data:

- `Person`
- `WebSite`
- `ProfilePage`
- `BlogPosting`
- `BreadcrumbList`
- `SoftwareSourceCode` or `CreativeWork` for projects

Optional AI-facing files:

- `/llms.txt`
- `/ai-context.json`

These are useful for agent ergonomics but must not be treated as a replacement for real SEO, since search engines do not require special AI files for AI search features.

## 11. Security Checklist

Frontend:

- CSP,
- no inline unsafe scripts unless explicitly hashed,
- secure cookies,
- no secrets in client bundle,
- strict form validation,
- Turnstile on comments and contact form.

Backend:

- input validation,
- SQL through typed queries, no string-built SQL,
- password hashing,
- rate limiting,
- CSRF for admin mutations,
- request body limits,
- audit logs,
- no detailed errors to clients.

Database:

- not publicly exposed,
- least-privilege DB user,
- migrations reviewed,
- daily backup,
- restore test before launch.

Infrastructure:

- Cloudflare proxy,
- HTTPS only,
- firewall only 80/443 public,
- SSH restricted,
- automatic OS security updates,
- GCP budget alerts,
- separate service account for backups.

MCP:

- auth required,
- no dangerous tools,
- tool-level scopes,
- origin validation,
- audit logs,
- explicit allowlist of tools.

CI/CD:

- no secrets exposed to forked pull requests,
- protected GitHub environments for staging and production,
- manual approval before production deploy,
- least-privilege GCP service account for deployment,
- separate deployment credentials from backup credentials,
- artifact provenance retained through build and deploy jobs,
- deployment logs kept without leaking secret values.

## 12. Testing Strategy

### Test Pyramid

Unit tests:

- Go auth helpers, config parsing, validators, slug normalization, response mapping, MCP tool helpers.
- Frontend utility functions and form validation behavior where logic exists.

Integration tests:

- PostgreSQL migration Up/Down.
- sqlc query behavior for profile, projects, posts, comments, sessions, and audit logs.
- Go API routes with a disposable PostgreSQL database.
- Admin auth/session flows with real cookies and hashed session tokens.
- MCP tools against isolated test data.

E2E tests:

- Public website navigation and rendering.
- Admin login.
- Draft creation.
- Publishing a post and verifying it appears publicly.
- Anonymous comment submission and moderation.
- Contact flow.

Smoke tests:

- `/api/healthz`.
- public homepage.
- admin login endpoint rejects invalid credentials.
- MCP health endpoint.
- database connectivity check in staging.

### Execution Policy

- Unit tests run on every pull request and push.
- Integration tests run on every pull request and push to `main`.
- E2E tests run on pull requests that touch app code and always before staging approval.
- Staging smoke/E2E tests must pass before production deploy can be approved.
- Test data must be disposable and must not contain real user secrets.

## 13. CI/CD and Environments

### Pull Request Pipeline

Required checks:

- install dependencies,
- frontend lint,
- frontend typecheck,
- frontend build,
- Go format check,
- Go tests for API and MCP,
- sqlc generation check,
- migration validation against PostgreSQL,
- targeted E2E tests when web/API paths change.

### Main Branch Pipeline

After merge to `main`:

- repeat required checks,
- build deployable artifacts/images,
- deploy to staging,
- run staging migrations,
- run staging smoke tests,
- run staging E2E tests.

### Approval Gate

Production deployment is blocked until the developer manually approves the GitHub `production` environment. Approval should happen only after reviewing:

- CI status,
- staging smoke/E2E results,
- migration summary,
- expected infrastructure changes,
- rollback note.

### Production Deployment

After approval:

- deploy the approved artifact to production,
- run production migrations,
- run production smoke checks,
- record deployment metadata,
- keep previous artifact/image available for rollback.

### Environment Model

Local:

- developer machine,
- local Docker PostgreSQL,
- local `.env` only.

CI:

- ephemeral GitHub Actions runner,
- service-container PostgreSQL,
- no production secrets.

Staging:

- separate app/database state from production,
- low-cost environment that may share the same VM only if isolated by compose project, database, ports, and secrets,
- seeded test/admin data only.

Production:

- real domain,
- production database,
- production secrets,
- protected by manual approval.

## 14. Cost Plan

Target: less than 50 PLN/month.

Expected V1 costs:

- Compute Engine e2-micro: potentially free tier if eligible region and limits are respected.
- Persistent disk: within free tier target where possible.
- Cloud Storage backups: low cost for small dumps.
- Cloud DNS: avoid in V1 by using Cloudflare Free.
- Cloud SQL: avoid in V1 because it can exceed budget.
- Cloud Armor: avoid in V1; use Cloudflare Free instead.

Budget controls:

- billing alerts at 20 PLN, 35 PLN, 45 PLN,
- weekly cost check,
- log retention limits,
- no managed SQL until needed.

## 15. Delivery Phases

### Phase 1: Foundation

- monorepo structure,
- Docker Compose,
- PostgreSQL migrations,
- Go API skeleton,
- Next.js skeleton,
- profile asset integration.

### Phase 2: Public Site

- home,
- about,
- projects,
- blog index,
- blog detail,
- contact.

### Phase 3: Admin and Publishing

- admin auth,
- post editor,
- project manager,
- media upload,
- comment moderation.

### Phase 4: MCP

- MCP server skeleton,
- read-only tools,
- admin tools,
- authorization,
- audit logging.

### Phase 5: SEO/GEO

- metadata,
- structured data,
- sitemap,
- RSS,
- llms.txt,
- AI context endpoint.

### Phase 6: Deployment and Hardening

- GCP VM,
- Cloudflare DNS,
- Caddy HTTPS,
- backups,
- security checklist,
- restore test,
- monitoring and budget alerts.

### Phase 7: Testing and CI/CD

- unit test suites,
- integration test suites,
- Playwright E2E tests,
- GitHub Actions PR checks,
- staging deployment workflow,
- manual production approval gate,
- production deploy workflow,
- rollback documentation.

## 16. Open Decisions

- Domain name.
- Whether admin MFA is mandatory in V1.
- Whether comments require email address or display name only.
- Whether MCP is private-only in V1 or has a read-only public mode.
- Whether blog editor should use Markdown, rich text, or both.
- Whether staging should run on the same low-cost VM with isolated compose resources or a separate temporary VM.
- Which E2E scenarios are mandatory for every pull request versus only before deployment.
