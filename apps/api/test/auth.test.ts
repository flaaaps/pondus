import { sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { api, createTestApp, registerUser } from "./helpers.js"
import type { App } from "../src/app.js"

let app: App
let close: () => Promise<void>
beforeAll(async () => ({ app, close } = await createTestApp()))
afterAll(() => close())

describe("auth", () => {
  it("registers, logs in, refreshes and logs out", async () => {
    const u = await registerUser(app, { email: "Alice@Example.com" })
    const me = await api(app, u.token, "GET", "/auth/me")
    expect(me.status).toBe(200)
    expect((me.json as { email: string }).email).toBe("alice@example.com")

    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "alice@example.com", password: u.password } })
    expect(login.statusCode).toBe(200)

    const refresh = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: u.refreshToken } })
    expect(refresh.statusCode).toBe(200)
    const second = refresh.json().tokens.refreshToken as string

    // The client never saw that response (connection dropped): presenting the old token again within the
    // grace window hands out a new pair and retires the one it missed, so exactly one token stays valid.
    const retry = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: u.refreshToken } })
    expect(retry.statusCode).toBe(200)
    const third = retry.json().tokens.refreshToken as string
    const missed = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: second } })
    expect(missed.statusCode).toBe(401)
    // The retired pair cannot be revived through the grace window either (its replacement was never issued).
    const missedAgain = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: second } })
    expect(missedAgain.statusCode).toBe(401)

    const logout = await api(app, u.token, "POST", "/auth/logout", { refreshToken: third })
    expect(logout.status).toBe(204)
    const afterLogout = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: third } })
    expect(afterLogout.statusCode).toBe(401)
    // A logged-out token has no replacement, so the grace window does not apply.
    const oldAfterLogout = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: u.refreshToken } })
    expect(oldAfterLogout.statusCode).toBe(401)
  })

  it("rejects a rotated-away refresh token once the grace window has passed", async () => {
    const u = await registerUser(app)
    const refresh = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: u.refreshToken } })
    expect(refresh.statusCode).toBe(200)
    // Age the rotation beyond the window instead of waiting for it.
    await app.db.execute(sql`update refresh_tokens set revoked_at = now() - interval '10 minutes' where revoked_at is not null`)
    const late = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: u.refreshToken } })
    expect(late.statusCode).toBe(401)
    const current = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: refresh.json().tokens.refreshToken } })
    expect(current.statusCode).toBe(200)
  })

  it("rejects duplicate emails, bad passwords and unauthenticated access", async () => {
    const u = await registerUser(app)
    const dup = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: u.email, password: "another-password-1", displayName: "X" } })
    expect(dup.statusCode).toBe(409)
    const bad = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: u.email, password: "wrong-password-1" } })
    expect(bad.statusCode).toBe(401)
    const short = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "x@y.de", password: "short", displayName: "X" } })
    expect(short.statusCode).toBe(400)
    expect(short.json().error.code).toBe("validation_error")
    const noAuth = await app.inject({ method: "GET", url: "/api/v1/me/profile" })
    expect(noAuth.statusCode).toBe(401)
  })
})
