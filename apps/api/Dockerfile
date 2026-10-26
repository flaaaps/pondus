# Build context must be the monorepo root (needs packages/shared):
#   podman build -f apps/api/Dockerfile -t pondus-api .
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
# embedded-postgres is dev-only and has no use in the image; argon2/esbuild need their postinstall.
RUN pnpm install --frozen-lockfile --filter @pondus/api... --config.allowBuilds.embedded-postgres=false
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @pondus/api build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @pondus/api...

FROM node:24-alpine AS runtime
# Set by CI to the git commit (shown by /health); local builds report "dev".
ARG APP_VERSION=dev
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4010 APP_VERSION=$APP_VERSION
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/drizzle ./apps/api/drizzle
COPY apps/api/package.json ./apps/api/
WORKDIR /app/apps/api
USER node
EXPOSE 4010
# Podman builds OCI images and drops HEALTHCHECK; the Quadlet unit (deploy/pi) defines the same check instead.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:4010/health || exit 1
# Migrations and reference-data seed are idempotent, so they run on every start.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && exec node dist/server.js"]
