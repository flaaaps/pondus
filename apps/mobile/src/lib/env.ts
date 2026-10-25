import Constants from "expo-constants"

/** API base URL. In dev on a simulator, the host machine is reachable via 127.0.0.1. */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  const host = Constants.expoConfig?.hostUri?.split(":")[0]
  return host ? `http://${host}:4010` : "http://127.0.0.1:4010"
}
