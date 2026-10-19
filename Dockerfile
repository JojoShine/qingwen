FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@10.26.0

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc LICENSE ./
RUN pnpm install --frozen-lockfile
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm db:generate

FROM dependencies AS builder
COPY . .
ARG NEXT_PUBLIC_BASE_PATH=
ENV BUILD_STANDALONE=1 NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
RUN pnpm build

FROM dependencies AS production-dependencies
RUN pnpm prune --prod

# The delivered image contains both the application and PostgreSQL.
FROM postgres:17-bookworm AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini libstdc++6 openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 node \
    && useradd --uid 1000 --gid node --create-home node
COPY --from=base /usr/local/bin/node /usr/local/bin/node
COPY --from=base /usr/local/lib/node_modules/pnpm /usr/local/lib/node_modules/pnpm
RUN ln -s ../lib/node_modules/pnpm/bin/pnpm.cjs /usr/local/bin/pnpm
ARG NEXT_PUBLIC_BASE_PATH=
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH} POSTGRES_USER=survey POSTGRES_DB=survey UPLOAD_DIR=/var/lib/qingwen/uploads
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=dependencies --chown=node:node /app/prisma ./prisma
COPY --from=dependencies --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node src/lib/db.ts src/lib/password.ts src/lib/attachment-storage.ts ./src/lib/
COPY --chown=node:node deploy/docker/storage-check.ts ./deploy/docker/
COPY --chmod=755 deploy/docker/backup.sh /usr/local/bin/qingwen-backup.sh
RUN install -d -m 700 -o node -g node /var/lib/qingwen/uploads
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --chown=node:node LICENSE ./LICENSE
COPY --chmod=755 deploy/docker/entrypoint.sh /usr/local/bin/qingwen-entrypoint.sh
STOPSIGNAL SIGTERM
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=90s --retries=3 \
    CMD if [ -z "$DATABASE_URL" ]; then pg_isready -q -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1; fi; node -e "fetch('http://127.0.0.1:3000'+process.env.NEXT_PUBLIC_BASE_PATH+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/qingwen-entrypoint.sh"]
CMD ["node", "server.js"]
