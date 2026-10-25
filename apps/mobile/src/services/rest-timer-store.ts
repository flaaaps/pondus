import * as Notifications from "expo-notifications"
import { create } from "zustand"
import { haptic } from "@/lib/haptics"
import { useSettingsStore } from "./settings-store"

interface RestTimerState {
  /** Wall-clock end time; survives app background and re-renders. */
  endsAt: number | null
  durationSeconds: number
  remainingWhenPaused: number | null
  notificationId: string | null
  label: string | null
  start: (seconds: number, label?: string) => void
  pause: () => void
  resume: () => void
  adjust: (deltaSeconds: number) => void
  stop: () => void
  /** Change what the timer is "for" (e.g. "Weiter: Hip Thrust" after moving on to the next exercise). */
  setLabel: (label: string | null) => void
  /** Seconds left right now (0 when idle). */
  remaining: () => number
  isRunning: () => boolean
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
})

let permissionAsked = false
async function scheduleEnd(seconds: number, label: string | null): Promise<string | null> {
  if (!useSettingsStore.getState().restTimerNotifications) return null
  try {
    if (!permissionAsked) {
      permissionAsked = true
      const p = await Notifications.getPermissionsAsync()
      if (p.status !== "granted") await Notifications.requestPermissionsAsync()
    }
    return await Notifications.scheduleNotificationAsync({
      content: { title: "Pause vorbei", body: label ? `Weiter mit ${label}` : "Nächster Satz", sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), repeats: false },
    })
  } catch {
    return null
  }
}
async function cancel(id: string | null) {
  if (!id) return
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
  } catch {
    /* ignore */
  }
}

export const useRestTimerStore = create<RestTimerState>()((set, get) => ({
  endsAt: null,
  durationSeconds: 0,
  remainingWhenPaused: null,
  notificationId: null,
  label: null,
  start(seconds, label) {
    void cancel(get().notificationId)
    const endsAt = Date.now() + seconds * 1000
    set({ endsAt, durationSeconds: seconds, remainingWhenPaused: null, label: label ?? null, notificationId: null })
    void scheduleEnd(seconds, label ?? null).then(id => set(s => (s.endsAt === endsAt ? { notificationId: id } : {})))
  },
  pause() {
    const r = get().remaining()
    if (!get().endsAt || r <= 0) return
    void cancel(get().notificationId)
    set({ remainingWhenPaused: r, endsAt: null, notificationId: null })
  },
  resume() {
    const r = get().remainingWhenPaused
    if (r === null) return
    const endsAt = Date.now() + r * 1000
    set({ endsAt, remainingWhenPaused: null })
    void scheduleEnd(r, get().label).then(id => set(s => (s.endsAt === endsAt ? { notificationId: id } : {})))
  },
  adjust(delta) {
    const s = get()
    if (s.remainingWhenPaused !== null) return set({ remainingWhenPaused: Math.max(0, s.remainingWhenPaused + delta), durationSeconds: Math.max(0, s.durationSeconds + delta) })
    if (!s.endsAt) return
    void cancel(s.notificationId)
    const endsAt = Math.max(Date.now(), s.endsAt + delta * 1000)
    set({ endsAt, durationSeconds: Math.max(0, s.durationSeconds + delta), notificationId: null })
    void scheduleEnd((endsAt - Date.now()) / 1000, s.label).then(id => set(st => (st.endsAt === endsAt ? { notificationId: id } : {})))
  },
  stop() {
    void cancel(get().notificationId)
    set({ endsAt: null, remainingWhenPaused: null, notificationId: null, label: null })
  },
  setLabel(label) {
    set({ label })
  },
  remaining() {
    const s = get()
    if (s.remainingWhenPaused !== null) return s.remainingWhenPaused
    if (!s.endsAt) return 0
    return Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000))
  },
  isRunning() {
    return get().endsAt !== null
  },
}))

/** Called by the UI tick when the timer reaches zero while the app is foregrounded. */
export function onRestTimerFinished() {
  if (useSettingsStore.getState().restTimerHaptics) haptic("success")
  useRestTimerStore.getState().stop()
}
