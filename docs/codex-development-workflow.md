# Codex Development Workflow

## 1. Sources Checked

This workflow is based on:

- OpenAI Academy guidance that plugins connect Codex to tools/data, while skills are reusable playbooks for repeatable work.
- OpenAI skills catalog, which supports installing curated or experimental skills with `skill-installer`.
- Ralph Loop documentation, which uses a PRD, task lookup table, task files, iterative execution, tests, screenshots, and status tags.
- Endor Labs Codex skills documentation for security-oriented scanning workflows.
- MCP official documentation and the official Go SDK for MCP server development.

## 2. Skills and Plugins to Use

### Already Available in This Codex Session

- `browser-use:browser`
  - Use for local browser testing, screenshots, and interactive frontend QA.
- `skill-creator`
  - Use later if we want a project-specific skill for this portfolio platform.
- `plugin-creator`
  - Use later if we create a local Codex plugin around the project's MCP server.
- `imagegen`
  - Use only if we need generated raster visuals. For this site, the user's real profile photo should be primary.

### Recommended Skills to Add Later

These should be considered after the initial scaffold:

- `gh-fix-ci`
  - Useful once GitHub Actions exists.
- `gh-address-comments`
  - Useful once pull requests are used.
- `mcp-builder`
  - Useful for the MCP server design and quality checklist.
- `postgres`
  - Useful for schema, indexing, query plans, and operations.
- `frontend-testing`
  - Useful for admin/public UI testing patterns.
- `e2e-tester`
  - Useful for Playwright flows.
- Endor Labs security skills
  - Useful for dependency/security scanning, if the user wants to connect Endor Labs.

No new skills should be installed automatically without user approval. New skills/plugins can change the local environment and should be introduced intentionally.

## 3. Project-Specific Codex Skill Candidate

Create later as `.agents/skills/portfolio-platform/SKILL.md`.

Purpose:

- enforce architectural decisions,
- keep Go API, MCP, Next.js, PostgreSQL, and GCP constraints consistent,
- require security review for public inputs and MCP tools,
- require SEO/GEO checks for public pages.

Suggested trigger:

- "Use the portfolio-platform skill to implement the next task."

Core rules:

- backend in Go,
- database access through typed SQL,
- no public DB port,
- admin APIs require auth,
- comments require moderation,
- MCP tools require explicit scopes,
- public pages require metadata and structured data,
- monthly cost target remains under 50 PLN.

## 4. Ralph Loop Adaptation

Ralph Loop is a long-running agent loop that works through a task list until completion. It expects a PRD and task files, and each iteration should implement, test, verify, and update task status.

For this project, use Ralph-style iteration without immediately installing Ralph:

1. Pick the highest-priority incomplete task from `.agent/tasks.json`.
2. Read the matching `.agent/tasks/TASK-*.json`.
3. Implement only that task's scope.
4. Run the relevant tests and linters.
5. For frontend tasks, inspect the page in browser and capture/verify screenshots.
6. Update task status.
7. Commit only after the user asks for commits.

If we later install Ralph itself, this repository already contains the expected PRD/task structure.

## 5. Verification Gates

Every meaningful task should define at least one verification gate:

- Go API: `go test ./...`, `go vet ./...`, and eventually `golangci-lint run`.
- Frontend: typecheck, lint, unit tests.
- E2E: Playwright for public flows and admin flows.
- Database: migration up/down on disposable DB.
- Security: auth, rate limit, CSRF, input validation checks.
- SEO/GEO: metadata, structured data, sitemap, robots, RSS.
- MCP: tool schema validation and authorization tests.

## 6. Human Decision Points

Stop and ask before:

- buying/configuring domain,
- installing third-party Codex skills/plugins,
- creating external cloud resources,
- changing the monthly cost profile,
- exposing MCP publicly,
- adding analytics/tracking,
- requiring MFA.
