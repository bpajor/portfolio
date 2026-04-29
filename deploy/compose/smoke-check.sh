#!/usr/bin/env sh
set -eu

base_url="${BASE_URL:-${1:-}}"

if [ -z "$base_url" ]; then
  echo "Usage: BASE_URL=https://bpajor.dev ./smoke-check.sh" >&2
  exit 1
fi

base_url="${base_url%/}"

curl -fsS "${base_url}/api/healthz" >/dev/null

mcp_status="$(curl -sS -o /dev/null -w '%{http_code}' "${base_url}/mcp")"
if [ "$mcp_status" != "401" ]; then
  echo "Expected /mcp without bearer token to return 401, got ${mcp_status}." >&2
  exit 1
fi

for path in /robots.txt /sitemap.xml /llms.txt /ai-context.json; do
  curl -fsS "${base_url}${path}" >/dev/null
done

echo "Smoke checks passed for ${base_url}."
