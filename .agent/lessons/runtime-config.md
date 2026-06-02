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

## 2026-05-26 - Upload path hit production server timeout through a slow preview tunnel

What happened:

- A sub-1 MB media upload through Cloud Shell preview returned `media_upload_invalid`.
- Earlier API logs showed the same endpoint returning after about 15 seconds, which matched the API server `ReadTimeout`.

Why it happened:

- I validated upload size and MIME behavior but did not account for slow tunnels and browser-to-proxy-to-API transfer time.
- The server timeout was tuned for normal JSON requests, not multipart uploads over a preview tunnel.

What I should have done:

- Compare the failing request duration with server/proxy timeout settings before assuming request validation failed.
- Make runtime timeouts configurable and document why upload paths need a larger budget than normal admin JSON mutations.

Working rule:

- When a request fails only in deployed or tunneled environments, compare response status, request duration, content length, proxy logs, and application timeout settings before changing validation logic. Slow transport is part of the runtime contract.

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

## 2026-06-02 - Docker disk usage can masquerade as random build failures

What happened:

- A Docker-based `sqlc` generation attempt failed with low-level `bus error` / `input/output error` symptoms after downloading and compiling a heavy Go toolchain.
- Docker Desktop then got stuck while turning off, and the machine had several gigabytes of reclaimable Docker images and build cache.

Why it happened:

- I treated Docker as a disposable execution wrapper without first checking whether its image/cache footprint had grown large enough to threaten local disk space.
- I also chose a compile-from-source container flow when a smaller prebuilt tool image would have reduced disk and build-cache pressure.

What I should have done:

- Check `docker system df` before and after heavy Docker builds, especially when the task downloads compilers, language toolchains, or large base images.
- Prefer prebuilt purpose-specific tool images over compiling tools inside generic language images when the goal is just to run one generator.
- If Docker reports low-level runtime, overlay, bus error, or I/O failures, inspect disk/cache pressure before retrying the same expensive command.

Working rule:

- Treat Docker disk usage as part of the local runtime health check. For Docker-heavy work, monitor `docker system df`, prune unused images/build cache when safe, and avoid repeated heavy retries until disk pressure has been ruled out.

## 2026-06-02 - User-facing integration secrets need an app workflow

What happened:

- I suggested testing deployed MCP by retrieving bearer tokens from VM environment files.
- That made the feature operationally awkward and contradicted the product shape: admins should be able to create and revoke MCP client credentials from the admin app.

Why it happened:

- I treated environment variables as the source of truth because they already existed for deploy smoke tests.
- I did not distinguish bootstrap/runtime secrets from credentials that a real admin needs to issue to external clients.

What I should have done:

- Ask how an admin would create, copy, rotate, and revoke a token before calling the feature testable.
- Keep env tokens only as a fallback or bootstrap path, then add application-managed token lifecycle for normal use.

Working rule:

- If a human needs to use a credential in an external client, provide an application-level management workflow. VM/env inspection is acceptable for emergency debugging, not for normal product operation.

## 2026-06-02 - Deployment migrations must cover existing databases, not only first boot

What happened:

- A new schema migration added MCP token storage, but the Compose `migrate` service skipped schema work whenever the original `profile` table already existed.
- The release script recreated application containers without explicitly rerunning the one-shot migration service, so staging could run new MCP code against an old database schema.

Why it happened:

- I verified migration tests and CI integration setup, but did not inspect the production/staging migration path as a separate upgrade path.
- I treated Compose `depends_on` for a completed one-shot service as enough, even though releases recreate selected app services and may reuse an old completed migrator container.

What I should have done:

- For every schema change, test both fresh database bootstrap and existing deployment upgrade behavior.
- Ensure the release script explicitly runs migrations before restarting services that depend on the new schema.
- Make one-shot migration services track applied schema versions instead of using a single sentinel table as a proxy for all migrations.

Working rule:

- Schema deploys must prove the upgrade path for already-running environments. A migration runner should be idempotent, version-aware, and invoked directly by the release workflow before dependent services restart.
