#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"
if [[ "$1" == backup ]]; then
  # The entrypoint starts only PostgreSQL, never the web app, for this command.
  pnpm --dir /app exec tsx deploy/docker/storage-check.ts >&2
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f database.dump
  pg_restore --list database.dump > /dev/null
  tar -cf uploads.tar -C "$UPLOAD_DIR" .
  sha256sum database.dump uploads.tar > SHA256SUMS
  tar -cf - database.dump uploads.tar SHA256SUMS
elif [[ "$1" == restore-backup ]]; then
  cat > backup.tar
  # Only regular files with these exact names may be extracted.
  [[ "$(tar -tf backup.tar | LC_ALL=C sort)" == $'SHA256SUMS\ndatabase.dump\nuploads.tar' ]]
  if tar -tvf backup.tar | LC_ALL=C grep -v '^-' > /dev/null; then echo '备份归档类型无效。' >&2; exit 1; fi
  tar -xf backup.tar --no-same-owner --no-same-permissions
  [[ $(wc -l < SHA256SUMS) -eq 2 ]]
  LC_ALL=C grep -Eq '^[0-9a-f]{64}  database.dump$' SHA256SUMS
  LC_ALL=C grep -Eq '^[0-9a-f]{64}  uploads.tar$' SHA256SUMS
  sha256sum --strict -c SHA256SUMS >&2
  pg_restore --list database.dump > /dev/null
  # Uploads have server-generated UUID names, never original user filenames.
  if tar -tf uploads.tar | LC_ALL=C grep -Ev '^\./$|^\./[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'; then echo '附件归档路径无效。' >&2; exit 1; fi
  if tar -tvf uploads.tar | LC_ALL=C grep -vE '^[-d]' > /dev/null; then echo '附件归档类型无效。' >&2; exit 1; fi
  mkdir files
  tar -xf uploads.tar -C files --no-same-owner --no-same-permissions
  # Import into the stopped installation. Keep unrelated old files for recovery;
  # never clear a volume as part of a restore or a normal container startup.
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --exit-on-error database.dump
  cp -a files/. "$UPLOAD_DIR/"
  sync -f "$UPLOAD_DIR"
  pnpm --dir /app exec tsx deploy/docker/storage-check.ts >&2
  echo '数据库和附件恢复成功。' >&2
else
  exit 2
fi
