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

# Separate tooling image: run migrations and explicit administrator initialization.
FROM dependencies AS migrator
COPY --chown=node:node src/lib/db.ts src/lib/password.ts ./src/lib/
USER node
CMD ["pnpm", "db:migrate"]

FROM dependencies AS builder
COPY . .
ENV BUILD_STANDALONE=1
RUN pnpm build

# No Prisma CLI, package manager, source tree or build credentials in the app image.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --chown=node:node LICENSE ./LICENSE
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
