# Steering

Current steering notes:

- Always consult `.agent/lessons-learned.md` before planning or changing CI, deployment, Terraform, Cloudflare, admin flows, authentication, CSRF, Turnstile, or production/staging operations.
- Go is not available in PATH. Install or expose a Go toolchain before Go build verification.
- Keep MCP private or token-protected until an explicit decision is made to expose read-only public tools.
- Avoid Cloud SQL in V1 to stay within the target monthly budget.
