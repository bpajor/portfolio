# Lessons Learned

This file captures mistakes, missed checks, and working rules from the collaboration. It is meant to be read before making deployment, CI, infrastructure, or admin-flow changes.

## 2026-05-16 - Terraform apply environment bypassed approval and missed vars

What happened:

- I added `terraform-apply.yml` and initially attached the apply job to the `production` environment so it would require approval.
- That environment did not contain the Terraform-specific variables and secrets, so apply failed with empty `TF_VAR_BACKUP_BUCKET_NAME`, `TERRAFORM_STATE_BUCKET`, and `GCP_TERRAFORM_SERVICE_ACCOUNT`.
- I then changed the job to use the `terraform` environment, which fixed variables but bypassed the intended production approval gate.

Why it happened:

- I treated "environment" as both a secrets/vars source and an approval boundary, but GitHub Actions uses the same field for both concerns.
- I did not verify which environment actually held the required Terraform configuration before choosing the apply job environment.
- I focused on fixing the immediate missing-variable failure and did not re-check the approval requirement after the change.

What I should have done:

- Inspect existing workflow environments and their purpose before editing the workflow.
- Split the concerns explicitly: a lightweight `production` approval job first, then a separate apply job using the `terraform` environment for vars/secrets.
- Explain this design before implementation because it affects the safety model.

Working rule:

- When a workflow needs both protected approval and environment-specific secrets, model them as separate jobs unless the same GitHub environment intentionally owns both.

## 2026-05-16 - Terraform service account lacked API enablement permissions

What happened:

- Terraform apply tried to enable `artifactregistry.googleapis.com` and failed with a 403 because the Terraform service account lacked permission to enable Google APIs.
- I had added the `google_project_service` resource without confirming the CI Terraform service account could manage Service Usage.

Why it happened:

- The Terraform plan could be generated with the current permissions, but apply needed stronger permissions.
- I validated Terraform syntax and provider schema, but not the IAM capability needed for new resource classes.

What I should have done:

- Before adding managed GCP services, list the additional roles required by the Terraform service account.
- Add an operator note and exact `gcloud` commands in the same PR, not only after the failure.
- Consider whether API enablement should be bootstrapped manually or managed by Terraform CI with `roles/serviceusage.serviceUsageAdmin`.

Working rule:

- Every new Terraform resource family must include an IAM impact check for the Terraform service account, especially `google_project_service`, IAM resources, Artifact Registry, DNS, billing, and service accounts.

## 2026-05-16 - Terraform apply also needed firewall update permissions

What happened:

- After adding Artifact Registry permissions, Terraform apply successfully enabled `artifactregistry.googleapis.com`, created the repository, and added image reader/writer IAM.
- The same apply then failed while updating `portfolio-allow-ssh-admin` because the Terraform service account lacked `compute.firewalls.update` and `compute.networks.updatePolicy`.

Why it happened:

- I scoped the IAM fix to the newly added Artifact Registry resources, but the plan also included a change to an existing Compute firewall rule.
- I did not treat "all resources in the current plan" as the permission boundary for the Terraform service account.

What I should have done:

- Read the full Terraform plan and list every resource action, including unrelated drift or variable-driven updates.
- Check required permissions for each action before asking the user to rerun apply.
- Prefer a role like `roles/compute.securityAdmin` for Terraform when it owns firewall rules, or avoid managing those rules through Terraform if that is not intended.

Working rule:

- Before Terraform apply, verify the service account can perform every planned action, not only the resources introduced by the current PR.

## 2026-05-16 - Artifact Registry deploy needed Terraform apply in CI

What happened:

- I first implemented Artifact Registry resources and deploy fallback, but did not include Terraform apply automation in the same PR.
- The user correctly pointed out that apply should also be handled by CI.

Why it happened:

- I treated infrastructure creation as a separate operational step, even though the project direction had already shifted toward GitHub Actions as the control plane.
- I optimized for a safe deploy fallback, but missed the full end-to-end workflow requirement.

What I should have done:

- For any feature depending on new infrastructure, design the full lifecycle in one pass: plan, apply approval, apply, deploy, verification, rollback.
- Explicitly ask whether infra apply is expected to be CI-managed if the existing repo direction suggests it.

Working rule:

- If deployment behavior depends on new Terraform resources, include or update the Terraform apply path in the same implementation unless explicitly deferred.

## 2026-05-16 - Fix was made on a stale branch after PR merge

What happened:

- After the Artifact Registry PR was merged, I made a small `terraform-apply` fix on the old branch instead of pulling `main` first.
- The user had to remind me to pull `main`.

Why it happened:

- I reacted to the failing CI log from the previous PR branch without first re-checking the current repository state.
- I did not pause to ask whether the PR had already merged before applying the fix.

What I should have done:

- Run `git status --short --branch`, switch to `main`, and pull before any post-merge fix.
- Treat user reports from CI as possibly referring to a branch that has already merged.

Working rule:

- Before every new fix after a CI result, confirm branch state and pull `main` unless the user explicitly says to continue on the current branch.

## 2026-05-05/06 - CSRF and production API URL issues escaped early tests

What happened:

- Cloud Shell preview origins caused `csrf_invalid` for admin mutations on staging.
- A production-only `/api/api/...` URL regression reached production-like flow despite staging being fine.

Why it happened:

- Tests were too mocked/local and did not exercise the exact deployed origin, proxy, and environment combinations.
- I trusted local unit/E2E coverage for paths that were actually environment-sensitive.

What I should have done:

- Reproduce failures against the real staging origin before claiming confidence.
- Add live staging E2E checks for Cloud Shell preview origin, admin mutations, and production API prefix behavior.
- Treat URL composition and CSRF origin checks as deployment-surface code, not just frontend helpers.

Working rule:

- For origin, CORS, CSRF, cookie, and API-prefix changes, require at least one real deployed-stack test or a targeted live E2E before production.

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

- If deploy mutates env for a service, restart that service or explicitly document why the env is build-time only.

## 2026-05-08 - Test expected an empty Turnstile token after widget integration

What happened:

- E2E expected `turnstileToken: ""`, but with Turnstile loaded it correctly submitted `XXXX.DUMMY.TOKEN.XXXX`.
- The test failed after the implementation became more realistic.

Why it happened:

- The assertion described the old no-widget behavior, not the intended behavior after introducing a test Turnstile key.
- I did not revisit test expectations as part of the feature semantics change.

What I should have done:

- Update E2E expectations to assert payload shape and that the token is a string, with live staging tests covering whether the backend accepts it.

Working rule:

- When adding third-party verification widgets, tests should verify both payload shape and server acceptance, not hard-code pre-integration placeholder values.

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

- Any validation change for deployed secrets must include a compatibility/migration check before merge.

## 2026-05-05 - Admin UI actions had misleading feedback

What happened:

- Archiving a post worked functionally, but the UI displayed "Draft saved".
- Dashboard counts showed stale or misleading published post numbers.

Why it happened:

- The UI reused save feedback for a different action.
- Tests covered that an API request happened, but not that the user-facing message matched the action.

What I should have done:

- Add tests for user-visible feedback and count semantics before fixing the implementation.
- Treat admin UI copy as part of behavior, especially where it confirms destructive or state-changing actions.

Working rule:

- For admin mutations, tests should assert both backend state and user-facing confirmation text.

## 2026-05-05 - Blog page flashed static placeholder posts before API data loaded

What happened:

- The public writing page briefly displayed static placeholder posts before API posts loaded.
- The final state was correct, but the half-second flash looked unprofessional.

Why it happened:

- The component used static fallback data as initial UI state instead of reserving fallback for true API failure.
- Existing tests checked final rendered state, not the initial loading state.

What I should have done:

- Reproduce the visual issue and add a test that placeholder posts are not visible while API data is still pending.
- Distinguish loading, success, and fallback/error states explicitly.

Working rule:

- For API-backed public pages, test the initial/loading state, not only the final state after data resolves.

## 2026-05-05 - Public route E2E was brittle against real content changes

What happened:

- A public E2E expected the static "low-cost production portfolio" blog link.
- Once API-backed/admin-published posts changed the visible content, the test failed even though the route itself was healthy.

Why it happened:

- The test asserted a specific seed/static post instead of the page contract.
- The public site had moved toward dynamic content, but the test still assumed static content as canonical.

What I should have done:

- Assert stable page structure and separately test API-published content with seeded/controlled test data.
- Avoid coupling route smoke tests to mutable editorial content.

Working rule:

- Public smoke tests should assert stable landmarks; content tests should seed or mock the content they require.

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

- For reverse proxy config changes, validate the generated config before restarting the proxy.

## 2026-05-03 - GitHub environment protection assumptions were wrong

What happened:

- A production deploy started without the expected approval.
- The workflow used an environment name, but GitHub protection settings were not actually enforcing required reviewers yet.

Why it happened:

- I assumed the existence of an environment implied approval behavior.
- I did not ask the user to verify GitHub Environment protection rules before relying on them.

What I should have done:

- Treat environment protection as external configuration that must be verified separately.
- Include a checklist: environment exists, required reviewers configured, admin bypass behavior understood.

Working rule:

- Never infer approval guarantees from workflow YAML alone; verify GitHub environment protection settings.

## 2026-05-02/03 - VM builds were too heavy and deploy strategy needed to change

What happened:

- Building Docker images on the small VM was extremely slow and sometimes appeared stuck.
- Later, copying image archives through IAP/SFTP took 4-8 minutes.

Why it happened:

- The initial deployment model underestimated the cost of builds and large binary transfers on a low-cost VM and through IAP.
- I solved the immediate blocker first, but the long-term deployment strategy needed to be captured earlier.

What I should have done:

- Record the bottleneck as soon as the first VM build stalled.
- Move earlier toward prebuilt images, then toward registry-backed deploys with retention.

Working rule:

- When a deployment step becomes slow enough to interrupt flow, document it as a strategy problem, not only an incident.
