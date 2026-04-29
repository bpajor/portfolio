#!/usr/bin/env sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if [ -f "${script_dir}/.env" ]; then
  set -a
  . "${script_dir}/.env"
  set +a
fi

bucket="${BACKUP_BUCKET:?BACKUP_BUCKET is required, for example gs://bpajor-portfolio-backups}"
case "$bucket" in
  gs://*) ;;
  *) bucket="gs://${bucket}" ;;
esac

backup_path="$("${script_dir}/backup-postgres.sh")"
gcloud storage cp "$backup_path" "${bucket%/}/"

printf '%s\n' "${bucket%/}/$(basename "$backup_path")"
