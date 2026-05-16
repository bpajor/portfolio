# CI, Deploy, and Infrastructure Lessons

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

- When one configuration field carries multiple responsibilities, verify each responsibility separately. For GitHub Actions environments, treat approval gates, secrets, variables, URLs, and protection rules as distinct concerns, even if YAML represents them through the same `environment` key.

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

- Before introducing a new infrastructure capability, identify every actor that must operate it, every permission they need for plan/apply/deploy/runtime, and the bootstrap step that grants those permissions. Do this before the first CI run, not after a permission failure.

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

- Validate the whole execution plan, not just the part you intended to change. Drift, variable changes, and adjacent resources can create extra actions, so permissions and rollback thinking must cover every planned operation.

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

- When a feature crosses system boundaries, design the whole lifecycle in one pass: provision, configure, deploy, verify, operate, and roll back. Do not stop at the code path that makes the immediate demo work.

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

- Before acting on any CI, deploy, or user-reported failure, establish current state first: branch, latest main, commit under test, environment, and whether the failing PR has already merged. Fix the current system, not a stale snapshot.

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

- Treat external platform settings as part of the system, not as assumptions. If safety depends on GitHub, Cloudflare, GCP, DNS, or billing configuration, verify the live setting before relying on it.

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

- When an operational step repeatedly slows or destabilizes work, stop treating it as an isolated incident. Record it as a design constraint, measure it, and move the architecture toward removing that class of bottleneck.
