import * as SecureStore from "expo-secure-store"
import { create } from "zustand"
import type { AuthResponse, TokenPair, UserDto } from "@pondus/shared"
import { createApiClient, type ApiClient, type TokenStore } from "@/lib/api-client"
import { queryClient } from "@/lib/query-client"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useWorkoutUiStore } from "@/features/workout/workout-ui-store"
import { kv, resetLocalDb } from "@/storage/db"
import { useRestTimerStore } from "./rest-timer-store"

const TOKEN_KEY = "pondus.tokens"
const USER_KEY = "pondus.user"
/** Account the local workout data (active workout, outbox, timer) belongs to. */
const OWNER_KEY = "local_owner_user_id"

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
  /** True while a manual sign-out runs: late 401s from in-flight requests must not report an expired session. */
  let signingOut = false
  const api = createApiClient({
    tokens: secureTokens,
    onSessionExpired: () => {
      if (signingOut || get().status === "signed_out") return
      void finishSignOut(true)
    },
  })
  const wipeLocalData = () => {
    resetLocalDb()
    // The stores still hold the old account's workout in memory; without this it would be saved again for the next account.
    useRestTimerStore.getState().stop()
    useActiveWorkoutStore.getState().clearLocal()
    useWorkoutUiStore.getState().reset()
  }
  const finishSignOut = async (expired: boolean) => {
    await api.setTokens(null)
    await SecureStore.deleteItemAsync(USER_KEY)
    queryClient.clear()
    // A session the server ended (expired) keeps the unsynced workout on the phone: the same account
    // will most likely sign in again in a moment and must not lose the sets logged so far. Someone
    // else signing in wipes it (see `adopt`). A deliberate sign-out wipes right away.
    if (!expired) wipeLocalData()
    set({ status: "signed_out", user: null, expired })
  }
  const claimLocalData = (userId: string) => {
    const owner = kv.get<string>(OWNER_KEY)
    if (owner && owner !== userId) wipeLocalData()
    kv.set(OWNER_KEY, userId)
  }
  const adopt = async (res: AuthResponse) => {
    await api.setTokens(res.tokens)
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.user))
    claimLocalData(res.user.id)
    set({ status: "signed_in", user: res.user, expired: false })
    // A workout still open on the server (signed out mid-session, new phone) continues where it was.
    void useActiveWorkoutStore.getState().resumeRemote(api)
  }
  return {
    status: "booting",
    user: null,
    api,
    expired: false,
    async restore() {
      const tokens = await api.getTokens()
      if (!tokens) return set({ status: "signed_out" })
      const cached = await SecureStore.getItemAsync(USER_KEY)
      // Optimistically restore from the cached user so the app opens instantly (offline too), then revalidate.
      if (cached) set({ status: "signed_in", user: JSON.parse(cached) as UserDto })
      try {
        const user = await api.get<UserDto>("/api/v1/auth/me")
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
        claimLocalData(user.id)
        set({ status: "signed_in", user })
        void useActiveWorkoutStore.getState().resumeRemote(api)
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
      // While signing out, 401s from requests still in flight (or from the logout call itself, when the
      // refresh token is already gone) must not end up as "session expired" on the login screen.
      signingOut = true
      try {
        await queryClient.cancelQueries()
        const tokens = await api.getTokens()
        try {
          if (tokens) await api.post("/api/v1/auth/logout", { refreshToken: tokens.refreshToken })
        } catch {
          /* offline logout is fine */
        }
        await finishSignOut(false)
      } finally {
        signingOut = false
      }
    },
    setUser: user => {
      void SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
      set({ user })
    },
  }
})

export const useApi = () => useSessionStore(s => s.api)
export const useUser = () => useSessionStore(s => s.user)
