#!/usr/bin/env bash
set -Eeuo pipefail

# Keep existing external-database deployments usable during their data migration.
if [[ -n "${DATABASE_URL:-}" ]]; then
  exec gosu node "$@"
fi

: "${POSTGRES_PASSWORD:?请配置 POSTGRES_PASSWORD}"
ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
  echo '请配置 ADMIN_PASSWORD，至少 8 位。' >&2
  exit 1
fi

# Encode credentials rather than interpolating them into a connection URL.
DATABASE_URL=$(node -e 'const u = new URL("postgresql://127.0.0.1:5432/"); u.username = process.env.POSTGRES_USER; u.password = process.env.POSTGRES_PASSWORD; u.pathname = "/" + process.env.POSTGRES_DB; u.search = "schema=public"; process.stdout.write(u.href)')
export DATABASE_URL

database_pid=
application_pid=
setup_pid=
cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$setup_pid" ]]; then kill -TERM "$setup_pid" 2>/dev/null || true; fi
  if [[ -n "$application_pid" ]]; then kill -TERM "$application_pid" 2>/dev/null || true; fi
  if [[ -n "$database_pid" ]]; then kill -INT "$database_pid" 2>/dev/null || true; fi
  if [[ -n "$setup_pid" ]]; then wait "$setup_pid" 2>/dev/null || true; fi
  if [[ -n "$application_pid" ]]; then wait "$application_pid" 2>/dev/null || true; fi
  if [[ -n "$database_pid" ]]; then wait "$database_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

# The official entrypoint initializes only an empty volume and drops to postgres.
docker-entrypoint.sh postgres -c listen_addresses=127.0.0.1 &
database_pid=$!
ready=false
for attempt in {1..90}; do
  if pg_isready -q -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"; then
    ready=true
    break
  fi
  if ! kill -0 "$database_pid" 2>/dev/null; then
    echo '内置 PostgreSQL 启动失败。' >&2
    exit 1
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo '等待内置 PostgreSQL 启动超时。' >&2
  exit 1
fi

run_setup() {
  local finished_pid
  gosu node "$@" <&0 &
  setup_pid=$!
  wait -n -p finished_pid "$database_pid" "$setup_pid"
  if [[ "$finished_pid" != "$setup_pid" ]]; then
    echo '初始化过程中 PostgreSQL 意外退出。' >&2
    exit 1
  fi
  setup_pid=
}

if [[ "${1:-}" == restore ]]; then
  # Run without the web app so a backup can be imported before serving requests.
  run_setup pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --exit-on-error
  exit 0
fi

run_setup pnpm db:migrate
run_setup pnpm db:seed
gosu node env -u ADMIN_PASSWORD -u POSTGRES_PASSWORD "$@" &
application_pid=$!
# If either service exits, stop its companion and let the container restart.
wait -n "$database_pid" "$application_pid"
