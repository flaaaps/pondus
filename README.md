# Pondus

Premium strength-training app for iOS: individual, adaptable training plans, fast workout logging that works offline, and honest progress tracking. Monorepo with a shared domain package, a Fastify/PostgreSQL API and an Expo (React Native) iOS app.

Docs: [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) · [`docs/BRAND_IDENTITY.md`](docs/BRAND_IDENTITY.md) · [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/DATABASE.md`](docs/DATABASE.md) · [`docs/API.md`](docs/API.md) · [`docs/TECHNICAL_DECISIONS.md`](docs/TECHNICAL_DECISIONS.md) · [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)

## Layout

```
packages/shared   domain logic (planner, progression, records), zod API contracts, exercise library
apps/api          Fastify 5 · Drizzle ORM · PostgreSQL
apps/mobile       Expo SDK 58 · React Native 0.88 · Expo Router (iOS only)
brand/            SVG sources for logo/icon + render script
```

## Requirements

Node ≥ 22, pnpm 12 (`corepack enable`). For the iOS app: macOS with Xcode 16+ and an iOS 18+/26 simulator. No Docker needed: the API can run an embedded PostgreSQL for development and tests.

## Setup

```bash
pnpm install
pnpm --filter @pondus/shared test          # domain unit tests
```

### API

```bash
cd apps/api
cp .env.example .env                       # set JWT secrets (openssl rand -base64 48)
pnpm db:dev                                # terminal 1: embedded PostgreSQL on 127.0.0.1:54329 (skip if you have a server; set DATABASE_URL)
pnpm db:migrate && pnpm db:seed            # terminal 2: schema + 160+ exercises
pnpm db:create-test-user                   # optional: test@pondus.local / pondus-test-1234
pnpm dev                                   # http://127.0.0.1:4010, Swagger UI at /docs
pnpm test                                  # integration tests (start their own temporary PostgreSQL)
```

Production: `pnpm build` (esbuild bundle in `dist/`), `node dist/db/migrate.js`, `node dist/db/seed.js`, `node dist/server.js`. Secrets only via environment variables (e.g. `infisical run -- node dist/server.js`).

### Mobile (iOS)

```bash
cd apps/mobile
cp .env.example .env                       # EXPO_PUBLIC_API_URL (simulator reaches the host via 127.0.0.1)
pnpm prebuild                              # generates ios/ (not committed)
pnpm ios                                   # builds the dev client and opens the simulator
pnpm typecheck && pnpm lint && pnpm test
```

Brand PNGs are generated from the SVG sources with `pnpm brand:icons` (root).

## Quality gates

`pnpm typecheck`, `pnpm lint`, `pnpm test` at the root run each package sequentially (the development host is a Raspberry Pi; keep parallelism low).

## Status

Backend, domain logic and the full iOS app are implemented and type-/lint-/test-clean. The app has not yet been run in an iOS simulator from this environment (no Xcode here) – see `docs/IMPLEMENTATION_PLAN.md` for the remaining QA steps.
