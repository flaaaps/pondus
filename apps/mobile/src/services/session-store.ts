import * as SecureStore from "expo-secure-store"
import { create } from "zustand"
import type { AuthResponse, TokenPair, UserDto } from "@pondus/shared"
import { createApiClient, type ApiClient, type TokenStore } from "@/lib/api-client"
import { queryClient } from "@/lib/query-client"
import { resetLocalDb } from "@/storage/db"

const TOKEN_KEY = "pondus.tokens"
const USER_KEY = "pondus.user"

/** Tokens live in the iOS Keychain via expo-secure-store; never in AsyncStorage. */
const secureTokens: TokenStore = {
  get: async () => {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as TokenPair) : null
  },
  set: async tokens => {
    if (tokens) await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK })
    else await SecureStore.deleteItemAsync(TOKEN_KEY)
  },
}

export type SessionStatus = "booting" | "signed_out" | "signed_in"

interface SessionState {
  status: SessionStatus
  user: UserDto | null
  api: ApiClient
  /** Set when the server rejected the refresh token: show a friendly re-login message. */
  expired: boolean
  restore: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  setUser: (user: UserDto) => void
}

export const useSessionStore = create<SessionState>()((set, get) => {
  const api = createApiClient({
    tokens: secureTokens,
    onSessionExpired: () => {
      void finishSignOut(true)
    },
  })
  const finishSignOut = async (expired: boolean) => {
    await secureTokens.set(null)
    await SecureStore.deleteItemAsync(USER_KEY)
    queryClient.clear()
    resetLocalDb()
    set({ status: "signed_out", user: null, expired })
  }
  const adopt = async (res: AuthResponse) => {
    await secureTokens.set(res.tokens)
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.user))
    set({ status: "signed_in", user: res.user, expired: false })
  }
  return {
    status: "booting",
    user: null,
    api,
    expired: false,
    async restore() {
      const tokens = await secureTokens.get()
      if (!tokens) return set({ status: "signed_out" })
      const cached = await SecureStore.getItemAsync(USER_KEY)
      // Optimistically restore from the cached user so the app opens instantly (offline too), then revalidate.
      if (cached) set({ status: "signed_in", user: JSON.parse(cached) as UserDto })
      try {
        const user = await api.get<UserDto>("/api/v1/auth/me")
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
        set({ status: "signed_in", user })
      } catch (err) {
        // Offline: keep the cached session. 401 is handled by onSessionExpired.
        if (!cached && get().status === "booting") set({ status: "signed_out" })
        void err
      }
    },
    async signIn(email, password) {
      await adopt(await api.post<AuthResponse>("/api/v1/auth/login", { email, password }, { auth: false }))
    },
    async register(email, password, displayName) {
      await adopt(await api.post<AuthResponse>("/api/v1/auth/register", { email, password, displayName }, { auth: false }))
    },
    async signOut() {
      const tokens = await secureTokens.get()
      try {
        if (tokens) await api.post("/api/v1/auth/logout", { refreshToken: tokens.refreshToken })
      } catch {
        /* offline logout is fine */
      }
      await finishSignOut(false)
    },
    setUser: user => {
      void SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
      set({ user })
    },
  }
})

export const useApi = () => useSessionStore(s => s.api)
export const useUser = () => useSessionStore(s => s.user)
