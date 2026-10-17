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

# One image runs the app by default, or explicit migration/initialization commands.
FROM base AS runner
ARG NEXT_PUBLIC_BASE_PATH=
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=dependencies --chown=node:node /app/prisma ./prisma
COPY --from=dependencies --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node src/lib/db.ts src/lib/password.ts ./src/lib/
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --chown=node:node LICENSE ./LICENSE
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000'+process.env.NEXT_PUBLIC_BASE_PATH+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
