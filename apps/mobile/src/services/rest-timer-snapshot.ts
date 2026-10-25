/** The part of the rest timer that survives an app restart (a Live Activity button can cold-start the app mid-rest). */
export interface RestTimerSnapshot {
  endsAt: number | null
  durationSeconds: number
  remainingWhenPaused: number | null
  notificationId: string | null
  label: string | null
}

export const IDLE_REST_TIMER: RestTimerSnapshot = { endsAt: null, durationSeconds: 0, remainingWhenPaused: null, notificationId: null, label: null }

export function toRestTimerSnapshot(s: RestTimerSnapshot): RestTimerSnapshot {
  return { endsAt: s.endsAt, durationSeconds: s.durationSeconds, remainingWhenPaused: s.remainingWhenPaused, notificationId: s.notificationId, label: s.label }
}

export const isRestTimerIdle = (s: RestTimerSnapshot) => s.endsAt === null && s.remainingWhenPaused === null

/** A saved timer as it should come back: a rest that ran out while the app was gone is dropped. */
export function restoreRestTimer(saved: RestTimerSnapshot | null, now: number): RestTimerSnapshot {
  if (!saved || isRestTimerIdle(saved)) return IDLE_REST_TIMER
  if (saved.remainingWhenPaused !== null) return { ...toRestTimerSnapshot(saved), endsAt: null }
  if (saved.endsAt !== null && saved.endsAt <= now) return IDLE_REST_TIMER
  return toRestTimerSnapshot(saved)
}
