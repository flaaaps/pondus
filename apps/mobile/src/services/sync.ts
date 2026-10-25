import { useEffect } from "react"
import { AppState } from "react-native"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useApi } from "./session-store"

/**
 * Flush the outbox whenever the app returns to the foreground and on a slow
 * heartbeat while a workout is active. No background processing: iOS gives
 * us no reliable guarantees there, and the queue is durable anyway.
 */
export function useOutboxSync() {
  const api = useApi()
  const flush = useActiveWorkoutStore(s => s.flush)
  const pending = useActiveWorkoutStore(s => s.pending)
  useEffect(() => {
    void flush(api)
    const sub = AppState.addEventListener("change", state => {
      if (state === "active") void flush(api)
    })
    return () => sub.remove()
  }, [api, flush])
  useEffect(() => {
    if (!pending) return
    const t = setInterval(() => void flush(api), 15_000)
    return () => clearInterval(t)
  }, [pending, api, flush])
}
