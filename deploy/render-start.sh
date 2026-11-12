#!/bin/bash
# Start-up for the single Render container: prepare settings, migrate, seed once, create the first owner once,
# then run the API (internal) and the web server (public). If either exits, the container exits and Render restarts it.
set -euo pipefail

# Render's managed Postgres gives postgres://…; SQLAlchemy with psycopg 3 wants postgresql+psycopg://…
if [[ -z "${SALAM_DATABASE_URL:-}" && -n "${DATABASE_URL:-}" ]]; then
  export SALAM_DATABASE_URL="$(sed -E 's#^postgres(ql)?://#postgresql+psycopg://#' <<<"$DATABASE_URL")"
fi

# Public address users type (used for links and the Origin check). Render provides it automatically.
export SALAM_APP_URL="${SALAM_APP_URL:-${RENDER_EXTERNAL_URL:-}}"

# The 2FA encryption key must be a Fernet key; derive one from Render's generated secret if none was given.
if [[ -z "${SALAM_MFA_ENCRYPTION_KEY:-}" && -n "${SALAM_SECRET_SEED:-}" ]]; then
  export SALAM_MFA_ENCRYPTION_KEY="$(python -c 'import base64,hashlib,os; print(base64.urlsafe_b64encode(hashlib.sha256(os.environ["SALAM_SECRET_SEED"].encode()).digest()).decode())')"
fi

cd /app/backend
alembic upgrade head
python -m app.cli seed --if-empty
python -m app.cli bootstrap

uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips='127.0.0.1' --workers 1 &

cd /app/web
PORT="${PORT:-10000}" HOSTNAME=0.0.0.0 node server.js &

wait -n
exit $?
