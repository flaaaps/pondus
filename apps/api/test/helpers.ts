import { randomUUID } from "node:crypto"
import { buildApp, type App } from "../src/app.js"
import { loadEnv } from "../src/config/env.js"
import { createDb } from "../src/db/client.js"
import { sql } from "drizzle-orm"

export async function createTestApp(): Promise<{ app: App; close: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error("TEST_DATABASE_URL missing (global setup did not run)")
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: url,
    JWT_ACCESS_SECRET: "test-access-secret-test-access-secret-1234",
    JWT_REFRESH_SECRET: "test-refresh-secret-test-refresh-secret-1234",
    ACCESS_TOKEN_TTL: "15m",
    RATE_LIMIT_MAX: "100000",
    LOG_LEVEL: "silent",
  })
  const { db, pool } = createDb(url, { max: 4 })
  const app = await buildApp({ env, db, logger: false })
  await app.ready()
  return {
    app,
    close: async () => {
      await app.close()
      await pool.end()
    },
  }
}

export async function truncateUserData(app: App) {
  await app.db.execute(sql`truncate users cascade`)
}

export async function registerUser(app: App, overrides: Partial<{ email: string; password: string; displayName: string }> = {}) {
  const body = { email: `${randomUUID()}@test.local`, password: "test-password-123", displayName: "Tester", ...overrides }
  const res = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: body })
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`)
  const json = res.json()
  return { ...body, userId: json.user.id as string, token: json.tokens.accessToken as string, refreshToken: json.tokens.refreshToken as string }
}

export function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

export async function api(app: App, token: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: unknown, headers: Record<string, string> = {}) {
  const res = await app.inject({ method, url: `/api/v1${url}`, headers: { ...auth(token), ...headers }, payload: payload === undefined ? undefined : (payload as Record<string, unknown>) })
  let json: unknown = null
  try {
    json = res.body ? res.json() : null
  } catch {
    json = res.body
  }
  return { status: res.statusCode, json: json as never, headers: res.headers }
}

export async function setupOnboardedUser(app: App, profile: Record<string, unknown> = {}) {
  const user = await registerUser(app)
  const res = await api(app, user.token, "PUT", "/me/profile", {
    primaryGoal: "hypertrophy",
    experienceLevel: "intermediate",
    sessionDurationMinutes: 60,
    weeklyFrequency: 4,
    environment: "full_gym",
    musclePriorities: [{ muscle: "chest", priority: 1 }, { muscle: "back", priority: 2 }],
    ...profile,
  })
  if (res.status !== 200) throw new Error(`profile failed: ${res.status} ${JSON.stringify(res.json)}`)
  return user
}

export async function exerciseIdBySlug(app: App, token: string, slug: string): Promise<string> {
  const res = await api(app, token, "GET", `/exercises?q=${encodeURIComponent(slug)}&limit=50`)
  const found = (res.json as { items: { id: string; slug: string }[] }).items.find(e => e.slug === slug)
  if (!found) throw new Error(`exercise ${slug} not found`)
  return found.id
}
