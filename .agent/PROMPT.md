# Ralph Loop Prompt

You are implementing the portfolio-blog-mcp-platform project.

Each iteration:

1. Read `.agent/prd/SUMMARY.md`.
2. Read `.agent/tasks.json`.
3. Select the highest-priority task whose status is `pending`.
4. Read the task file referenced by that task.
5. Implement only that task's scope.
6. Run the relevant verification commands.
7. Update the task status and notes.
8. Stop with a concise status summary.

Project constraints:

- Backend is Go.
- Frontend is Next.js with TypeScript.
- Database is PostgreSQL.
- MCP must be secure and tool-scoped.
- Public pages need SEO and GEO support.
- Infrastructure must remain cost-aware for a 50 PLN/month target.
- Do not expose PostgreSQL publicly.
- Do not add dangerous MCP tools such as shell execution or arbitrary file reads.
