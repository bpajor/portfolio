# Runtime Configuration and Secrets Lessons

## 2026-05-25 - Writable runtime volume was not owned by the non-root container user

What happened:

- Admin media upload worked in local/API tests but failed on staging through Caddy.
- The deployed API container ran as the non-root `app` user while the Docker named volume mounted at `/data/media` was owned by root, so the API could not write uploaded files.

Why it happened:

- I validated the HTTP behavior and compose syntax but did not validate the deployed filesystem contract: mount path, owner, permissions, and runtime user.
- I treated "volume exists" as enough, even though non-root containers need explicit ownership preparation for writable mounts.

What I should have done:

- For every new persistent writable path, check the runtime user and run a write probe in the target container shape.
- Add an idempotent deploy/init step that prepares ownership instead of relying on manual VM commands or Docker defaults.

Working rule:

- Any feature that writes to runtime storage must verify the full storage contract: configured path, mounted volume, container user, ownership, permissions, persistence, and failure response. For non-root containers, add an explicit init or deploy step that makes writable volumes writable before the service starts.

## 2026-05-08/16 - Turnstile worked in the browser but API still failed verification

What happened:

- The public comment form showed Turnstile success and sent a token, but the API returned `turnstile_failed`.
- The frontend was correct. The deployed API container still had stale runtime env and had not picked up the staging test `TURNSTILE_SECRET_KEY`.

Why it happened:

- A web-only deploy updated frontend behavior and `.env`, but did not recreate API/MCP containers.
- I initially focused on the comment form and token path instead of checking container age and runtime env.

What I should have done:

- Immediately compare request payload, API response, `.env`, and running container creation time.
- Treat every `.env` mutation in deploy scripts as a possible reason to restart runtime services, even if their images did not change.

Working rule:

- Any configuration change must be traced to the process that consumes it. After mutating env, secrets, files, or remote config, verify the running service has actually reloaded or been recreated before testing the feature.

## 2026-05-06 - Admin password validation broke existing production env

What happened:

- Password validation was tightened and production deploy started failing because the existing production admin password did not satisfy the new uppercase/symbol requirements.
- The password hash in the database was later updated, but `.env` validation was also part of deploy.

Why it happened:

- I treated new validation as a pure improvement without checking compatibility with current deployed secrets.
- I did not separate "password used to bootstrap/reset an account" from "existing hashed password already in the DB".

What I should have done:

- Check current production/staging env assumptions before tightening validation.
- Provide a migration path: update secret first, then enforce validation, or make validation apply only when bootstrapping/resetting.

Working rule:

- Any stricter validation, policy, or invariant for existing deployed data/secrets must ship with a migration or compatibility plan. First inspect current production/staging values, then decide whether to migrate, grandfather, or fail closed.

## 2026-05-20 - Real admin password was reused as a test fixture

What happened:

- A real admin password value was copied into frontend and backend tests as a convenient strong-password fixture.
- GitGuardian correctly flagged the PR as containing a hardcoded generic password.

Why it happened:

- I optimized for quickly matching the current deployed password policy instead of treating the value as operationally sensitive.
- I did not scan all touched files for reused secrets before pushing.

What I should have done:

- Use synthetic generated values for tests, preferably built dynamically enough that they cannot be confused with a real credential.
- Search for any real secret-looking value before commit and after writing tests/docs around auth or env configuration.

Working rule:

- Never use production, staging, or personally chosen credentials as examples, docs, tests, or fixtures. Test credentials must be clearly synthetic and should be generated or constructed in test code.

## 2026-05-03 - Caddy multi-domain config failed because of comma-separated site addresses

What happened:

- Production Caddy failed when `SITE_ADDRESS=bpajor.dev,www.bpajor.dev`.
- Caddyfile site addresses cannot be written as a single comma-containing token in that context.

Why it happened:

- I suggested an env value format without checking Caddyfile parsing rules and existing template usage.
- The validation script did not catch the Caddy adapter error before restart.

What I should have done:

- Verify Caddy config syntax with `caddy validate` or container logs before recommending an env mutation.
- Add validation for `SITE_ADDRESS` format if the Caddyfile expects space-separated addresses.

Working rule:

- For generated configuration, validate the rendered artifact with the real parser or runtime before restart/apply. Template-looking correctness is weaker than parser-verified correctness.
