# One container for Render's free plan (a single web service):
#   Next.js serves the site on $PORT and proxies /api/* to FastAPI on 127.0.0.1:8000 inside the same container,
#   so the browser still talks to one origin and cookies stay first-party.
# The two-service docker-compose.yml remains the setup for a VPS.

FROM node:20-bookworm-slim AS web
WORKDIR /web
ENV NEXT_TELEMETRY_DISABLED=1 \
    API_ORIGIN=http://127.0.0.1:8000
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# Node runtime for the Next.js standalone server (same major version it was built with).
COPY --from=web /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home /app salam
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt
COPY backend/ backend/
COPY --from=web /web/.next/standalone web/
COPY --from=web /web/.next/static web/.next/static
COPY --from=web /web/public web/public
COPY deploy/render-start.sh start.sh
RUN chmod +x start.sh && chown -R salam:salam /app
USER salam
CMD ["/app/start.sh"]
