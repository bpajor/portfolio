# Steering

Current steering notes:

- Always consult `.agent/lessons-learned.md` and the relevant `.agent/lessons/*.md` topic file before planning or changing CI, deployment, Terraform, Cloudflare, admin flows, authentication, CSRF, Turnstile, or production/staging operations.
- Record new mistakes, missed checks, and reusable process improvements in the most relevant `.agent/lessons/*.md` topic file. Create a new topic file when no existing topic fits. Keep `.agent/lessons-learned.md` short as an index and place only broad decision rules there.
- Go is not available in PATH. Install or expose a Go toolchain before Go build verification.
- Keep MCP private or token-protected until an explicit decision is made to expose read-only public tools.
- Avoid Cloud SQL in V1 to stay within the target monthly budget.
