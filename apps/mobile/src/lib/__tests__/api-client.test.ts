import type { TokenPair } from "@pondus/shared"
import { createApiClient, type TokenStore } from "../api-client"

const pair = (n: number, expiresInMs = 10 * 60_000): TokenPair => ({
  accessToken: `access-${n}`,
  accessTokenExpiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  refreshToken: `refresh-${n}`,
  refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
})

function memoryStore(initial: TokenPair | null, opts: { failWrites?: () => boolean } = {}): TokenStore & { saved: (TokenPair | null)[] } {
  let value = initial
  const saved: (TokenPair | null)[] = []
  return {
    saved,
    get: async () => value,
    set: async t => {
      if (opts.failWrites?.()) throw new Error("keychain unavailable")
      value = t
      saved.push(t)
    },
  }
}

type Call = { url: string; auth: string | null; body: unknown }
/** Fake server: refresh rotates the pair; other routes answer 200 for the current access token and 401 otherwise. */
function fakeServer(initial: TokenPair, opts: { dropRefreshResponse?: () => boolean; graceWindow?: boolean } = {}) {
  const calls: Call[] = []
  let current = initial
  let previous: TokenPair | null = null
  let n = 1
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    const body = init?.body ? JSON.parse(init.body as string) : null
    calls.push({ url, auth: headers.authorization ?? null, body })
    if (url.endsWith("/auth/refresh")) {
      const presented = body.refreshToken as string
      const ok = presented === current.refreshToken || (opts.graceWindow && presented === previous?.refreshToken)
      if (!ok) return new Response(JSON.stringify({ error: { code: "unauthorized", message: "bad refresh" } }), { status: 401 })
      previous = current
      current = pair(++n)
      if (opts.dropRefreshResponse?.()) throw new TypeError("Network request failed")
      return new Response(JSON.stringify({ tokens: current }), { status: 200 })
    }
    if (headers.authorization !== `Bearer ${current.accessToken}`) return new Response(JSON.stringify({ error: { code: "unauthorized", message: "bad access" } }), { status: 401 })
    return new Response(JSON.stringify({ ok: true, url }), { status: 200 })
  }) as unknown as typeof fetch
  return { calls, fetchImpl, current: () => current }
}

describe("api client tokens", () => {
  it("keeps a rotated pair in memory when the keychain write fails, and persists it later", async () => {
    const start = pair(1, 5_000) // about to expire: next request refreshes first
    const server = fakeServer(start)
    let failWrites = true
    const store = memoryStore(start, { failWrites: () => failWrites })
    const expired = jest.fn()
    const api = createApiClient({ tokens: store, onSessionExpired: expired, fetchImpl: server.fetchImpl, baseUrl: "http://t" })

    await expect(api.get("/api/v1/x")).resolves.toEqual({ ok: true, url: "http://t/api/v1/x" })
    expect(server.calls.map(c => c.url.replace("http://t", ""))).toEqual(["/api/v1/auth/refresh", "/api/v1/x"])
    expect(server.calls[1]!.auth).toBe(`Bearer ${server.current().accessToken}`)
    expect(store.saved).toEqual([]) // write failed, pair only in memory
    expect(expired).not.toHaveBeenCalled()

    failWrites = false
    await api.get("/api/v1/y")
    expect(store.saved).toEqual([server.current()]) // retried on the next request
    expect(await store.get()).toEqual(server.current())
    expect(expired).not.toHaveBeenCalled()
  })

  it("survives a refresh whose response never arrived, thanks to the server's grace window", async () => {
    const start = pair(1, 5_000)
    let refreshes = 0
    const server = fakeServer(start, { dropRefreshResponse: () => refreshes++ === 0, graceWindow: true })
    const store = memoryStore(start)
    const expired = jest.fn()
    const api = createApiClient({ tokens: store, onSessionExpired: expired, fetchImpl: server.fetchImpl, baseUrl: "http://t" })

    // The first refresh rotates on the server, but its answer is lost; the request goes out with the old access
    // token and is rejected; the second refresh (old refresh token, within grace) succeeds and the request is retried.
    await expect(api.get("/api/v1/x")).resolves.toEqual({ ok: true, url: "http://t/api/v1/x" })
    const urls = server.calls.map(c => c.url.replace("http://t", ""))
    expect(urls).toEqual(["/api/v1/auth/refresh", "/api/v1/x", "/api/v1/auth/refresh", "/api/v1/x"])
    expect(expired).not.toHaveBeenCalled()
    expect(await store.get()).toEqual(server.current())
  })

  it("signs out only when the server rejects the refresh token", async () => {
    const start = pair(1, 5_000)
    const server = fakeServer(start, { graceWindow: false })
    const store = memoryStore(pair(1, 5_000))
    // Somebody else rotated already: the stored refresh token is stale.
    await server.fetchImpl("http://t/api/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: start.refreshToken }) })
    const expired = jest.fn()
    const api = createApiClient({ tokens: store, onSessionExpired: expired, fetchImpl: server.fetchImpl, baseUrl: "http://t" })
    await expect(api.get("/api/v1/x")).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledTimes(1)
    expect(await store.get()).toBeNull()
  })

  it("setTokens replaces the in-memory pair used for requests", async () => {
    const server = fakeServer(pair(1))
    const store = memoryStore(null)
    const api = createApiClient({ tokens: store, onSessionExpired: jest.fn(), fetchImpl: server.fetchImpl, baseUrl: "http://t" })
    await api.setTokens(server.current())
    await expect(api.get("/api/v1/x")).resolves.toMatchObject({ ok: true })
    await api.setTokens(null)
    expect(await api.getTokens()).toBeNull()
    expect(server.calls.at(-1)!.auth).toBe(`Bearer ${server.current().accessToken}`)
  })
})
