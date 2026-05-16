# Lessons Learned

Read this index before making implementation, CI, deployment, infrastructure, auth, admin, or public-surface changes. Then open the relevant topic file.

## Core Rules

- Verify current state before acting: branch, latest `main`, commit under test, environment, and whether the failing PR has already merged.
- When behavior crosses boundaries, identify the boundary first: browser/server, build/runtime, CI/VM, proxy/app, GitHub/GCP/Cloudflare, or admin/public.
- Local mocks are not proof for environment-sensitive behavior. Add a check at the same boundary where production can fail.
- Validate the whole lifecycle for cross-system features: provision, configure, deploy, verify, operate, and roll back.
- Inspect the full execution plan, not only the part you intended to change.
- Any stricter validation or policy for deployed data/secrets needs a migration or compatibility plan.
- If configuration changes, verify the process that consumes it has actually reloaded or restarted.
- Prefer tests that fail for the right reason over tests that merely pass in one environment.
- Keep smoke tests focused on stable contracts; use seeded or mocked data for mutable content.
- Repeated operational pain is a design constraint, not just an incident.

## Topic Files

- [CI, Deploy, and Infrastructure](lessons/ci-deploy-infra.md)
- [Testing and Verification](lessons/testing.md)
- [Runtime Configuration and Secrets](lessons/runtime-config.md)
- [Admin, UX, and Public Content](lessons/admin-ux-content.md)

## Update Rules

- New lessons should go into the most relevant topic file.
- Keep this index short. Add or refine general rules here only when the lesson changes how future agents should decide.
- Each topic entry should include the concrete incident, the cause, what should have been checked earlier, and a reusable working rule.
