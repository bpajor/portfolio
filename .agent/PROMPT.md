# Ralph Loop Prompt

You are implementing the portfolio-blog-mcp-platform project.

Each iteration:

1. Read `.agent/lessons-learned.md` first and apply its working rules before making implementation, CI, deploy, infrastructure, or admin-flow decisions.
2. Read `.agent/prd/SUMMARY.md`.
3. Read `.agent/tasks.json`.
4. Select the highest-priority task whose status is `pending`.
5. Read the task file referenced by that task.
6. Implement only that task's scope.
7. Run the relevant verification commands.
8. Update the task status and notes.
9. Stop with a concise status summary.

Project constraints:

- Backend is Go.
- Frontend is Next.js with TypeScript.
- Database is PostgreSQL.
- MCP must be secure and tool-scoped.
- Public pages need SEO and GEO support.
- Infrastructure must remain cost-aware for a 50 PLN/month target.
- Do not expose PostgreSQL publicly.
- Do not add dangerous MCP tools such as shell execution or arbitrary file reads.
- When in doubt, pause and check `.agent/lessons-learned.md` again before repeating a documented mistake.
