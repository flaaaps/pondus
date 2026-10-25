import type { TokenPair } from "@pondus/shared"
import { apiBaseUrl } from "./env"

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
  get isNetwork() {
    return this.status === 0
  }
}

export interface TokenStore {
  get: () => Promise<TokenPair | null>
  set: (tokens: TokenPair | null) => Promise<void>
}

export interface ApiClientOptions {
  tokens: TokenStore
  onSessionExpired: () => void
  fetchImpl?: typeof fetch
  baseUrl?: string
}

/**
 * Small fetch wrapper: JSON, Bearer auth, single-flight token refresh, and
 * normalised errors. Network failures become ApiError(status 0) so callers can
 * decide to queue work offline.
 */
export function createApiClient(opts: ApiClientOptions) {
  const base = opts.baseUrl ?? apiBaseUrl()
  const f = opts.fetchImpl ?? fetch
  let refreshing: Promise<TokenPair | null> | null = null

  async function refresh(): Promise<TokenPair | null> {
    if (!refreshing) {
      refreshing = (async () => {
        const current = await opts.tokens.get()
        if (!current) return null
        try {
          const res = await f(`${base}/api/v1/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: current.refreshToken }) })
          if (!res.ok) {
            if (res.status === 401) {
              await opts.tokens.set(null)
              opts.onSessionExpired()
            }
            return null
          }
          const json = (await res.json()) as { tokens: TokenPair }
          await opts.tokens.set(json.tokens)
          return json.tokens
        } catch {
          return null
        } finally {
          refreshing = null
        }
      })()
    }
    return refreshing
  }

  async function request<T>(method: string, path: string, body?: unknown, init: { auth?: boolean; headers?: Record<string, string>; retry?: boolean } = {}): Promise<T> {
    const auth = init.auth ?? true
    let tokens = auth ? await opts.tokens.get() : null
    if (auth && tokens && new Date(tokens.accessTokenExpiresAt).getTime() - Date.now() < 30_000) tokens = (await refresh()) ?? tokens
    const headers: Record<string, string> = { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) }
    if (auth && tokens) headers.authorization = `Bearer ${tokens.accessToken}`
    let res: Response
    try {
      res = await f(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    } catch (err) {
      throw new ApiError(0, "network_error", err instanceof Error ? err.message : "Netzwerkfehler")
    }
    if (res.status === 401 && auth && init.retry !== false) {
      const fresh = await refresh()
      if (fresh) return request<T>(method, path, body, { ...init, retry: false })
      opts.onSessionExpired()
    }
    if (res.status === 204) return null as T
    const text = await res.text()
    let json: unknown = null
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
    }
    if (!res.ok) {
      const e = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error
      throw new ApiError(res.status, e?.code ?? "http_error", e?.message ?? `HTTP ${res.status}`, e?.details)
    }
    return json as T
  }

  return {
    baseUrl: base,
    get: <T>(path: string, init?: { auth?: boolean }) => request<T>("GET", path, undefined, init),
    post: <T>(path: string, body?: unknown, init?: { auth?: boolean; headers?: Record<string, string> }) => request<T>("POST", path, body ?? {}, init),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
    delete: <T>(path: string) => request<T>("DELETE", path),
  }
}
export type ApiClient = ReturnType<typeof createApiClient>
