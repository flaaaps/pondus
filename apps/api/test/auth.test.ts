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
    // Rotation: the old refresh token is now dead.
    const reuse = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: u.refreshToken } })
    expect(reuse.statusCode).toBe(401)

    const logout = await api(app, u.token, "POST", "/auth/logout", { refreshToken: refresh.json().tokens.refreshToken })
    expect(logout.status).toBe(204)
    const afterLogout = await app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: refresh.json().tokens.refreshToken } })
    expect(afterLogout.statusCode).toBe(401)
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
