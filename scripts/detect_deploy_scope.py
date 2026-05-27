#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

SERVICES = ("web", "api", "mcp")


@dataclass
class Scope:
    web: bool = False
    api: bool = False
    mcp: bool = False
    database: bool = False
    terraform: bool = False
    deploy: bool = False
    verify: bool = False
    recovery_deploy: bool = False
    recovery_reasons: list[str] | None = None

    def __post_init__(self) -> None:
        if self.recovery_reasons is None:
            self.recovery_reasons = []


def run_git(args: list[str]) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def git_maybe(args: list[str]) -> str:
    try:
        return run_git(args)
    except subprocess.CalledProcessError:
        return ""


def classify_paths(paths: Iterable[str]) -> Scope:
    scope = Scope()
    for path in paths:
        if not path:
            continue
        if path.startswith(("apps/web/", "packages/")) or path in {
            "package.json",
            "package-lock.json",
            "apps/web/Dockerfile",
        }:
            scope.web = True
            scope.verify = True
        elif path.startswith("apps/api/") or path == "apps/api/Dockerfile":
            scope.api = True
            scope.verify = True
        elif path.startswith("apps/mcp/") or path == "apps/mcp/Dockerfile":
            scope.mcp = True
            scope.verify = True
        elif path.startswith("db/") or path in {"compose.dev.yml"} or path.startswith("scripts/test-migrations."):
            scope.api = True
            scope.mcp = True
            scope.database = True
            scope.verify = True
        elif path.startswith("deploy/compose/") or path == ".dockerignore":
            scope.deploy = True
            scope.verify = True
        elif path.startswith("infra/gcp/") or path == ".github/workflows/terraform-plan.yml":
            scope.terraform = True
            scope.verify = True
        elif path == ".github/workflows/terraform-apply.yml":
            scope.terraform = True
            scope.verify = True
        elif path in {".github/workflows/deploy.yml", ".github/workflows/pr-ci.yml"}:
            scope.deploy = True
            scope.verify = True
    return scope


def merge_scope(target: Scope, source: Scope) -> None:
    target.web = target.web or source.web
    target.api = target.api or source.api
    target.mcp = target.mcp or source.mcp
    target.database = target.database or source.database
    target.terraform = target.terraform or source.terraform
    target.deploy = target.deploy or source.deploy
    target.verify = target.verify or source.verify


def release_services(scope: Scope) -> list[str]:
    return [service for service in SERVICES if getattr(scope, service)]


def latest_revision(paths: list[str], fallback: str) -> str:
    revision = git_maybe(["log", "-1", "--format=%H", "--", *paths])
    return revision or fallback


def service_revisions(sha: str) -> dict[str, str]:
    return {
        "web": latest_revision(
            ["apps/web", "packages", "package.json", "package-lock.json", "apps/web/Dockerfile", ".dockerignore"],
            sha,
        ),
        "api": latest_revision(["apps/api", "apps/api/Dockerfile", "db", "scripts/test-migrations.sh", "scripts/test-migrations.ps1", "compose.dev.yml", ".dockerignore"], sha),
        "mcp": latest_revision(["apps/mcp", "apps/mcp/Dockerfile", "db", "compose.dev.yml", ".dockerignore"], sha),
    }


def deployment_revision(sha: str) -> str:
    return latest_revision(
        [
            "apps/web",
            "packages",
            "package.json",
            "package-lock.json",
            "apps/web/Dockerfile",
            "apps/api",
            "apps/api/Dockerfile",
            "apps/mcp",
            "apps/mcp/Dockerfile",
            "db",
            "scripts",
            "compose.dev.yml",
            "deploy/compose",
            ".dockerignore",
        ],
        sha,
    )


def changed_files_for_event(event_name: str, before: str, sha: str) -> list[str]:
    if event_name == "workflow_dispatch":
        return ["__manual_dispatch__"]
    base = before
    if not base or set(base) == {"0"}:
        base = run_git(["rev-parse", f"{sha}^"])
    output = run_git(["diff", "--name-only", base, sha])
    return [line for line in output.splitlines() if line]


def changed_files_for_run(head_sha: str) -> list[str]:
    parent = git_maybe(["rev-parse", f"{head_sha}^"])
    if not parent:
        return []
    output = git_maybe(["diff", "--name-only", parent, head_sha])
    return [line for line in output.splitlines() if line]


def is_ancestor(ancestor: str, descendant: str) -> bool:
    return subprocess.run(
        ["git", "merge-base", "--is-ancestor", ancestor, descendant],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode == 0


def latest_successful_service_deploys(
    runs: Iterable[dict],
    service_classifier: Callable[[dict], set[str]],
) -> dict[str, str]:
    latest: dict[str, str] = {}
    for run in runs:
        if not run.get("production_success"):
            continue
        services = service_classifier(run)
        for service in SERVICES:
            if service in services and service not in latest:
                latest[service] = run["head_sha"]
    return latest


def apply_service_drift_recovery(
    scope: Scope,
    desired_revisions: dict[str, str],
    latest_success: dict[str, str],
    ancestor_check: Callable[[str, str], bool] = is_ancestor,
) -> None:
    for service in SERVICES:
        desired = desired_revisions[service]
        deployed = latest_success.get(service)
        if deployed and ancestor_check(desired, deployed):
            continue
        setattr(scope, service, True)
        scope.verify = True
        if service in {"api", "mcp"}:
            scope.database = True
        scope.recovery_deploy = True
        reason = (
            f"{service}: no successful production deploy found"
            if not deployed
            else f"{service}: latest successful production deploy {deployed} does not include desired revision {desired}"
        )
        scope.recovery_reasons.append(reason)


def github_json(url: str, token: str) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20) as response:
        return json.load(response)


def fetch_completed_deploy_runs(repo: str, branch: str, token: str) -> list[dict]:
    params = urllib.parse.urlencode(
        {
            "branch": branch,
            "status": "completed",
            "per_page": "50",
        }
    )
    runs_url = f"https://api.github.com/repos/{repo}/actions/workflows/deploy.yml/runs?{params}"
    runs = github_json(runs_url, token).get("workflow_runs", [])
    results = []
    for run in runs:
        jobs_url = f"{run['jobs_url']}?per_page=100"
        jobs = github_json(jobs_url, token).get("jobs", [])
        results.append(
            {
                "head_sha": run["head_sha"],
                "event": run.get("event", "push"),
                "production_success": any(
                    job.get("name") == "Deploy production" and job.get("conclusion") == "success"
                    for job in jobs
                ),
            }
        )
    return results


def infer_run_services(run: dict) -> set[str]:
    if run.get("event") == "workflow_dispatch":
        return set(SERVICES)
    return set(release_services(classify_paths(changed_files_for_run(run["head_sha"]))))


def append_lines(path: str | None, lines: list[str]) -> None:
    if not path:
        return
    with Path(path).open("a", encoding="utf-8") as handle:
        for line in lines:
            handle.write(f"{line}\n")


def main() -> int:
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")
    sha = os.environ["GITHUB_SHA"]
    before = os.environ.get("GITHUB_EVENT_BEFORE", "")
    changed_files = changed_files_for_event(event_name, before, sha)

    if event_name == "workflow_dispatch":
        scope = Scope(web=True, api=True, mcp=True, database=True, terraform=True, deploy=True, verify=True)
    else:
        scope = classify_paths(changed_files)

    revisions = service_revisions(sha)
    deploy_revision = deployment_revision(sha)

    if event_name != "workflow_dispatch":
        token = os.environ.get("GITHUB_TOKEN", "")
        repo = os.environ.get("GITHUB_REPOSITORY", "")
        branch = os.environ.get("GITHUB_REF_NAME", "main")
        if token and repo:
            try:
                runs = fetch_completed_deploy_runs(repo, branch, token)
                latest_success = latest_successful_service_deploys(runs, infer_run_services)
                apply_service_drift_recovery(scope, revisions, latest_success)
            except Exception as exc:  # pragma: no cover - defensive workflow logging
                print(f"::warning::Could not inspect previous deploy runs for service drift: {exc}", file=sys.stderr)

    services = release_services(scope)
    app_changed = bool(services)
    expected_image_revisions = " ".join(f"{service}={revisions[service]}" for service in services)

    outputs = {
        "app_changed": str(app_changed).lower(),
        "web_changed": str(scope.web).lower(),
        "api_changed": str(scope.api).lower(),
        "mcp_changed": str(scope.mcp).lower(),
        "database_changed": str(scope.database).lower(),
        "terraform_changed": str(scope.terraform).lower(),
        "deploy_changed": str(scope.deploy).lower(),
        "release_services": " ".join(services),
        "deployment_revision": deploy_revision,
        "web_revision": revisions["web"],
        "api_revision": revisions["api"],
        "mcp_revision": revisions["mcp"],
        "expected_image_revisions": expected_image_revisions,
        "recovery_deploy": str(scope.recovery_deploy).lower(),
        "verify_required": str(scope.verify).lower(),
    }

    append_lines(os.environ.get("GITHUB_OUTPUT"), [f"{key}={value}" for key, value in outputs.items()])

    summary = [
        "## Deployment Scope",
        "",
        f"- App changed: `{outputs['app_changed']}`",
        f"- Release services: `{outputs['release_services'] or 'none'}`",
        f"- Expected image revisions: `{outputs['expected_image_revisions'] or 'none'}`",
        f"- Database checks: `{outputs['database_changed']}`",
        f"- Terraform changed: `{outputs['terraform_changed']}`",
        f"- Deploy scripts/workflows changed: `{outputs['deploy_changed']}`",
        f"- Deployment revision: `{deploy_revision}`",
        f"- Recovery deploy: `{outputs['recovery_deploy']}`",
    ]
    for reason in scope.recovery_reasons:
        summary.append(f"- Recovery reason: {reason}")
    summary.extend(
        [
            f"- Verify required: `{outputs['verify_required']}`",
            "",
            "Changed files:",
            "```text",
            *changed_files,
            "```",
        ]
    )
    append_lines(os.environ.get("GITHUB_STEP_SUMMARY"), summary)

    for key, value in outputs.items():
        print(f"{key}={value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
