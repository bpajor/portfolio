# Follow-Up Tasks

This backlog captures non-blocking work discovered during the first production release. These tasks should be turned into GitHub issues or PRs when the release path is stable.

The machine-readable backlog lives in [`follow-up-tasks.json`](./follow-up-tasks.json). Keep that file updated when adding implementation-ready tasks with scope, acceptance criteria, and tests.

## 1. Optimize Deploy Builds by Changed Surface

Status: Completed. CI and deploy workflows now classify changed paths and skip unrelated jobs/deploys, while keeping recovery deploys possible when earlier application commits still need deployment.

Problem:

- The deploy workflow currently builds web, API, and MCP images for every deployment.
- A backend-only change should not rebuild the frontend image if the web dependency surface did not change.
- This wastes GitHub Actions time and makes production deploy feedback slower.

Goal:

- Build and transfer only the images affected by a change.
- Preserve the current prebuilt-image deployment strategy so the `e2-micro` VM remains a runtime target, not a build worker.

Suggested approach:

- Define path groups for `web`, `api`, `mcp`, shared packages, migrations, and deployment files.
- Use changed-file detection in `deploy.yml` to decide which images need rebuilding.
- Reuse the currently deployed image tags for unchanged services, or move to immutable image tags plus a small manifest that Compose can consume.
- Keep a full rebuild fallback for dependency, Dockerfile, compose, lockfile, or shared package changes.

Acceptance criteria:

- API-only changes do not trigger a web image build.
- MCP-only changes do not trigger web or API image builds unless shared dependencies changed.
- Shared package, lockfile, Dockerfile, or compose changes still trigger the required dependent image builds.
- Staging and production deploys remain reproducible and rollback-friendly.

## 2. Improve Discoverability for "Blazej Pajor" / "Błażej Pajor"

Status: Completed. Production now has SEO/GEO assets, metadata, sitemap/RSS/LLM assets, structured data, canonical URLs, and production verification for the public site.

Problem:

- Searching Google for the author's name does not reliably surface the site.
- Existing SEO/GEO assets exist, but the production launch needs real-world indexing and identity validation work.

Goal:

- Improve search visibility for queries such as `Blazej Pajor`, `Blazej Pajor portfolio`, and the Polish spelling `Błażej Pajor`.
- Improve both classic SEO and GEO, meaning the site should be easy for search engines and AI systems to understand, cite, and summarize.

Suggested approach:

- Verify Google Search Console ownership for `bpajor.dev`.
- Submit `https://bpajor.dev/sitemap.xml`.
- Inspect whether `robots.txt`, sitemap, canonical URLs, metadata, JSON-LD, and Open Graph data are correct in production.
- Add or improve person/profile structured data for the homepage.
- Add clear internal links and text signals that associate the domain with the author's full name.
- Check indexing status after deployment and request indexing for the homepage and key public pages.
- Consider external identity signals later, such as GitHub profile link, LinkedIn link, and consistent profile metadata.

Acceptance criteria:

- Google Search Console shows the homepage and sitemap as discovered and indexable.
- The homepage has valid structured data for the author/person and website.
- Searching for the name begins surfacing the domain or Search Console indicates no technical blocker remains.
- GEO assets remain aligned with real page content and do not rely on hidden text or misleading keyword stuffing.

## 3. Expand Automated Test Coverage, Especially Playwright E2E

Status: Completed. The suite now covers public navigation, API-backed blog rendering, comments, admin post CRUD, admin comment moderation, deployed staging admin checks, CSRF regression coverage, placeholder-flash coverage, admin auth ops, media CRUD, and selected media rendering. Future coverage should be added alongside new features rather than tracked as a broad standalone task.

Problem:

- The app has useful smoke coverage, but the production release showed that the most valuable confidence comes from real browser and deployed-stack checks.
- Playwright Chromium E2E coverage should be much broader, especially for public navigation, admin workflows, API-backed UI states, and release-critical paths.
- Backend and deployment scripts also need more focused regression tests so CI catches breakage before staging or production deploys.

Goal:

- Add substantially more automated tests, with emphasis on Playwright Chromium E2E tests that exercise the app like a real user.
- Keep tests reliable enough to run in PR CI and deployment gates.
- Cover both happy paths and critical failure/authorization states.

Suggested approach:

- Add Playwright E2E coverage for homepage navigation, blog/project detail pages, contact flows, admin authentication, content CRUD paths, error states, and responsive/mobile layouts.
- Add E2E checks for security-sensitive behavior such as MCP `401` without bearer token, admin-only routes, cookie flags, and CSRF/session behavior.
- Add production-like E2E scenarios against staging after deploy, not only against local dev.
- Add API integration tests for key endpoints, validation errors, database-backed flows, and authorization boundaries.
- Add shell/script tests for deploy helpers, backup/restore helpers, env generation, and preflight validation.
- Keep tests deterministic: seed data explicitly, avoid timing assumptions, and use stable selectors.

Acceptance criteria:

- PR CI has broader Playwright Chromium coverage for public and admin user journeys.
- Staging deploy gate catches broken navigation, API integration, and auth-protected flows.
- Backend tests cover critical API/MCP behavior and failure cases.
- Deploy and backup scripts have regression checks for the mistakes already seen during release.
- The suite remains fast enough to be useful and documents any intentionally slow tests.

## 4. Deploy Images Through Artifact Registry

Status: Completed. Staging and production deploys now use Artifact Registry image refs when the repository exists, with the previous IAP/SCP archive path retained as a fallback.

Problem:

- The deploy workflow currently transfers a compressed `docker save` archive to the VM over IAP/SFTP.
- The archive is around 80 MB today and can take several minutes when IAP throughput is poor.
- Slow or opaque transfers make deploys feel stuck and can block staging feedback.

Goal:

- Push built images to Google Artifact Registry from GitHub Actions.
- Let the VM pull immutable image tags during deploy instead of receiving a large tarball over SSH.
- Keep IAP for remote command execution, but remove large binary transfers from the SSH tunnel.

Suggested approach:

- Create or configure an Artifact Registry Docker repository.
- Tag web, API, and MCP images with the Git commit SHA and keep revision labels.
- Grant GitHub Actions permission to push images.
- Grant the VM service account permission to pull images.
- Update deploy scripts to pull requested tags and recreate only changed services.
- Document rollback using previously published tags.

Acceptance criteria:

- Deploy workflows no longer use `gcloud compute scp` for large image archives.
- VM pulls images directly from Artifact Registry.
- Deploy logs show image tags and digests for each service.
- Retrying a failed deploy does not require rebuilding images if tags already exist.
- Rollback to a previous image tag is documented and tested on staging.

## 5. Add Per-Service Deployment Drift Recovery

Status: Completed. Deploy scope detection now computes desired revisions per service, compares them with prior successful production deploys per service, and adds stale services to the next release set automatically.

Problem:

- Context-aware deploys choose `web`, `api`, and `mcp` from the latest changed files.
- If an earlier service deploy fails or is canceled, a later web-only deploy can succeed and leave production with a fresh web image but stale API or MCP images.
- A green production deploy can therefore hide service drift because it only proves the selected services were deployed.

Goal:

- Make deploy selection compare desired service revisions with the revisions actually running in staging and production.
- Automatically include any stale service in `RELEASE_SERVICES`, even when the newest merge did not touch that service.

Suggested approach:

- Inspect prior successful production deploys and infer which services each run actually released.
- Compute each service's desired revision from the latest commit affecting its source, shared dependencies, Dockerfile, compose, migrations, or deploy contract.
- Add stale services to the release set and clearly report the reason in the workflow summary.
- Label release images with their service-specific desired revision so unchanged services do not become stale just because another service deployed later.
- Keep `workflow_dispatch` as a full deploy fallback, but do not rely on manual reruns for normal drift recovery.

Acceptance criteria:

- If an API deploy fails and a later web-only commit reaches main, the next deploy includes API automatically.
- Workflow summaries show selected services and whether each was selected by changed files or drift recovery.
- Production cannot report a successful deploy while any required service remains on an older desired revision.
- Manual full deploy still works for emergency recovery.

## 6. Test MCP Behavior End to End

Status: Pending.

Problem:

- MCP is implemented and protected, but we still need an explicit deployed-stack validation pass.
- Unit and integration tests are useful, but they do not prove that the real `/mcp` route, Caddy, bearer tokens, staging data, and production protection all work together.

Goal:

- Verify MCP behavior as a real client would see it.
- Confirm that anonymous access is rejected, read-only tokens can use only read tools, and admin-scoped behavior remains intentional and safe.

Suggested approach:

- Run a staging smoke test against the deployed `/mcp` endpoint.
- Check missing/invalid bearer token behavior.
- Check valid read-only token initialization, tool listing, and representative read tool calls.
- Check that read-only tokens cannot call admin-only tools.
- Check the admin token only against intended admin MCP operations.
- Document a repeatable manual procedure and decide which parts should become CI.

Acceptance criteria:

- Staging `/mcp` returns `401` without a bearer token.
- Valid read-only token can initialize MCP and call expected read tools.
- Read-only token cannot call admin-only tools.
- Admin token behavior is verified only for intended tool scope.
- Production `/mcp` protection is verified before any public MCP exposure decision.
- The test procedure is documented enough to rerun after deploys.
