# Steering

Current steering notes:

- Treat `.agent/lessons-learned.md` and the relevant `.agent/lessons/*.md` topic files as a required pre-flight gate, not background reading. Before changing files or running task-specific commands, read them and state in the work update which lessons are being applied.
- Always consult `.agent/lessons-learned.md` and the relevant `.agent/lessons/*.md` topic file before planning or changing CI, deployment, Terraform, Cloudflare, admin flows, authentication, CSRF, Turnstile, or production/staging operations.
- For CI, deploy, PR, staging, production, Terraform, GitHub, or Git branch work, current-state verification must happen before implementation: branch, latest `main`, commit under test, PR state, and target environment. Do not push follow-up commits to a branch whose PR has already merged; create a fresh branch from current `main`.
- Record new mistakes, missed checks, and reusable process improvements in the most relevant `.agent/lessons/*.md` topic file. Create a new topic file when no existing topic fits. Keep `.agent/lessons-learned.md` short as an index and place only broad decision rules there.
- Go is not available in PATH. Install or expose a Go toolchain before Go build verification.
- Keep MCP private or token-protected until an explicit decision is made to expose read-only public tools.
- Avoid Cloud SQL in V1 to stay within the target monthly budget.
