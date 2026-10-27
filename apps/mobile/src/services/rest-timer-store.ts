import * as Notifications from "expo-notifications"
import { AppState } from "react-native"
import { create } from "zustand"
import { haptic } from "@/lib/haptics"
import { restTimerStorage } from "@/storage/rest-timer"
import { RestBell } from "../../modules/rest-bell"
import { createRestAlert, keepNotificationOnFinish, restNotificationId, type RestNotificationRequest } from "./rest-alert"
import { useSettingsStore } from "./settings-store"
import { isRestTimerIdle, restoreRestTimer, toRestTimerSnapshot } from "./rest-timer-snapshot"

interface RestTimerState {
  /** Wall-clock end time; survives app background and re-renders. */
  endsAt: number | null
  durationSeconds: number
  remainingWhenPaused: number | null
  notificationId: string | null
  label: string | null
  /** Brings back a rest saved before the app was closed; an expired one is dropped. */
  hydrate: () => void
  start: (seconds: number, label?: string) => void
  pause: () => void
  resume: () => void
  adjust: (deltaSeconds: number) => void
  /** Bell and notification again for the running rest (headphones or settings changed, app restarted). */
  rescheduleEnd: () => void
  /** Rest skipped: the bell is cancelled along with the notification. */
  stop: () => void
  /** Rest ran out (UI tick). Leaves the bell alone, it rings by itself; the notification only stays if asked to. */
  finish: (keepNotification: boolean) => void
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
async function scheduleNotification({ identifier, seconds, sound, label }: RestNotificationRequest): Promise<string | null> {
  try {
    if (!permissionAsked) {
      permissionAsked = true
      const p = await Notifications.getPermissionsAsync()
      if (p.status !== "granted") await Notifications.requestPermissionsAsync()
    }
    return await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title: "Pause vorbei", body: label ? `Weiter mit ${label}` : "Nächster Satz", sound: sound === "default" ? true : sound },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
    })
  } catch {
    return null
  }
}
const alert = createRestAlert({
  bell: RestBell,
  settings: () => {
    const s = useSettingsStore.getState()
    return { notifications: s.restTimerNotifications, bell: s.restBell, bellVolume: s.restBellVolume, bellDuck: s.restBellDuck }
  },
  now: Date.now,
  scheduleNotification,
})

/** Bell and/or notification for a rest ending at `endsAt`; the id lands in the store unless the rest changed meanwhile. */
function scheduleEnd(endsAt: number, label: string | null) {
  void alert.schedule(endsAt, label).then(({ notificationId }) => {
    if (useRestTimerStore.getState().endsAt === endsAt) useRestTimerStore.setState({ notificationId })
    else void cancel(notificationId)
  })
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
  hydrate() {
    set(restoreRestTimer(restTimerStorage.load(), Date.now()))
    // The bell's native state did not survive the restart; arm it again and move the notification behind it.
    get().rescheduleEnd()
  },
  start(seconds, label) {
    void cancel(get().notificationId)
    const endsAt = Date.now() + seconds * 1000
    set({ endsAt, durationSeconds: seconds, remainingWhenPaused: null, label: label ?? null, notificationId: null })
    scheduleEnd(endsAt, label ?? null)
  },
  pause() {
    const r = get().remaining()
    if (!get().endsAt || r <= 0) return
    void cancel(get().notificationId)
    alert.cancel()
    set({ remainingWhenPaused: r, endsAt: null, notificationId: null })
  },
  resume() {
    const r = get().remainingWhenPaused
    if (r === null) return
    const endsAt = Date.now() + r * 1000
    set({ endsAt, remainingWhenPaused: null })
    scheduleEnd(endsAt, get().label)
  },
  adjust(delta) {
    const s = get()
    if (s.remainingWhenPaused !== null) return set({ remainingWhenPaused: Math.max(0, s.remainingWhenPaused + delta), durationSeconds: Math.max(0, s.durationSeconds + delta) })
    if (!s.endsAt) return
    void cancel(s.notificationId)
    const endsAt = Math.max(Date.now(), s.endsAt + delta * 1000)
    set({ endsAt, durationSeconds: Math.max(0, s.durationSeconds + delta), notificationId: null })
    scheduleEnd(endsAt, s.label)
  },
  rescheduleEnd() {
    const s = get()
    if (s.endsAt === null) return
    // Same end, same identifier: scheduling again replaces the pending notification. Cancelling it
    // here could land after the new one and remove that instead. Only an id from an older build goes.
    if (s.notificationId !== restNotificationId(s.endsAt)) void cancel(s.notificationId)
    scheduleEnd(s.endsAt, s.label)
  },
  stop() {
    void cancel(get().notificationId)
    alert.cancel()
    set({ endsAt: null, remainingWhenPaused: null, notificationId: null, label: null })
  },
  finish(keepNotification) {
    if (!keepNotification) void cancel(get().notificationId)
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

// Every change is saved, so the rest survives a restart (e.g. when a Live Activity button cold-starts the app).
useRestTimerStore.subscribe(s => {
  const snapshot = toRestTimerSnapshot(s)
  if (isRestTimerIdle(snapshot)) restTimerStorage.clear()
  else restTimerStorage.save(snapshot)
})

/**
 * Called by the UI tick when the timer reaches zero: in the foreground, or in the background while the
 * bell's audio session keeps the app running.
 */
export function onRestTimerFinished() {
  if (useSettingsStore.getState().restTimerHaptics) haptic("success")
  useRestTimerStore.getState().finish(keepNotificationOnFinish(AppState.currentState === "active"))
}

// Headphones put on or taken off during a rest: bell or no bell decides when the notification comes
// and how it sounds. iOS reports these changes only while the app runs, i.e. while the bell keeps it alive.
RestBell?.addListener("onRouteChange", () => useRestTimerStore.getState().rescheduleEnd())

// Bell switched off: end the audio session now. Any change to bell or notification settings applies to
// a running rest right away.
useSettingsStore.subscribe((s, prev) => {
  const same = s.restBell === prev.restBell && s.restTimerNotifications === prev.restTimerNotifications && s.restBellVolume === prev.restBellVolume && s.restBellDuck === prev.restBellDuck
  if (same) return
  if (!s.restBell) alert.release()
  useRestTimerStore.getState().rescheduleEnd()
})
