FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S salam && adduser -S salam -G salam
COPY --from=build --chown=salam:salam /app/.next/standalone ./
COPY --from=build --chown=salam:salam /app/.next/static ./.next/static
COPY --from=build --chown=salam:salam /app/public ./public
USER salam
EXPOSE 3000
CMD ["node", "server.js"]
