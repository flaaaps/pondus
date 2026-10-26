import type { BellArmResult, RestBellModule } from "../../modules/rest-bell"

/**
 * How the end of a rest is announced: the bell through headphones, the "Pause vorbei" notification,
 * or both, with the notification as the safety net.
 *
 * The bell only rings if the app is still running at the end of the rest (see the native module), so
 * the notification is always scheduled as well. With the bell armed it comes `BELL_GRACE_MS` later
 * and the native side removes it the moment the bell starts playing. If the bell cannot play (app
 * killed, phone call, headphones taken off), the notification arrives a few seconds late instead of
 * not at all. Without headphones nothing changes: notification at the end, default sound.
 */

/** Bundled by the expo-notifications `sounds` option; also what the native bell plays. */
export const BELL_SOUND_FILE = "rest-bell.wav"
/** Head start of the bell over the fallback notification. Longer than the native late tolerance (1.5 s). */
export const BELL_GRACE_MS = 3000
/**
 * The silent session stays up this long after a rest. The next rest is usually started within a
 * minute or two, often from the Live Activity while the app is in the background, where iOS would
 * not let it start a new session.
 */
export const BELL_LINGER_MS = 10 * 60 * 1000

export const BELL_VOLUMES = [
  { value: "0.4", label: "Leise" },
  { value: "0.7", label: "Mittel" },
  { value: "1", label: "Laut" },
] as const

export interface RestAlertSettings {
  notifications: boolean
  bell: boolean
  /** 0…1, relative to the system volume. */
  bellVolume: number
}

export type BellPort = Pick<RestBellModule, "isAvailable" | "headphonesConnected" | "arm" | "disarm" | "release">

export interface RestNotificationRequest {
  identifier: string
  /** Seconds from now, for a time-interval trigger. */
  seconds: number
  /** The custom bell sound when it stands in for the bell, otherwise the iOS default. */
  sound: "default" | typeof BELL_SOUND_FILE
  label: string | null
}

/** Known up front, so the native bell can remove the notification without a round trip through JS. */
export const restNotificationId = (endsAt: number) => `rest-end-${endsAt}`

/** Whether to try the bell for a rest at all. */
export function shouldTryBell(settings: RestAlertSettings, bell: { available: boolean; headphones: boolean }): boolean {
  return settings.bell && bell.available && bell.headphones
}

/** The notification for a rest ending at `endsAt`, given whether the bell is armed for it. */
export function fallbackNotification(settings: RestAlertSettings, endsAt: number, bellArmed: boolean, label: string | null, now: number): RestNotificationRequest | null {
  if (!settings.notifications) return null
  const at = endsAt + (bellArmed ? BELL_GRACE_MS : 0)
  return {
    identifier: restNotificationId(endsAt),
    seconds: Math.max(1, Math.round((at - now) / 1000)),
    sound: bellArmed ? BELL_SOUND_FILE : "default",
    label,
  }
}

/**
 * The UI tick reached zero. In front of the app the notification would only repeat what the screen
 * shows, so it goes. In the background the tick only runs because the bell keeps the app alive; then
 * the notification stays: either the bell removes it, or it is the alert.
 */
export const keepNotificationOnFinish = (appActive: boolean) => !appActive

export interface RestAlertDeps {
  /** `null` without the native module (Jest, Expo Go, an older dev client). */
  bell: BellPort | null
  settings: () => RestAlertSettings
  now: () => number
  scheduleNotification: (request: RestNotificationRequest) => Promise<string | null>
}

export type BellState = BellArmResult | "off"

export function createRestAlert(deps: RestAlertDeps) {
  const env = () => {
    const bell = deps.bell
    if (!bell) return { available: false, headphones: false }
    try {
      return { available: bell.isAvailable(), headphones: bell.headphonesConnected() }
    } catch {
      return { available: false, headphones: false }
    }
  }
  const quietly = (run: () => Promise<void>) => {
    try {
      void run().catch(() => undefined)
    } catch {
      /* native module gone */
    }
  }

  return {
    /**
     * Announces the end of a rest at `endsAt`. The bell is armed first because the notification's
     * time and sound depend on whether that worked. The arm call is issued synchronously, so a later
     * `cancel()` always reaches the native side after it.
     */
    async schedule(endsAt: number, label: string | null): Promise<{ notificationId: string | null; bell: BellState }> {
      const settings = deps.settings()
      let bell: BellState = "off"
      if (deps.bell && shouldTryBell(settings, env())) {
        try {
          bell = await deps.bell.arm(endsAt, settings.bellVolume, settings.notifications ? restNotificationId(endsAt) : null, BELL_LINGER_MS)
        } catch {
          bell = "session-failed"
        }
      } else if (deps.bell) {
        // A bell armed for an earlier rest must not ring for this one.
        quietly(() => deps.bell!.disarm())
      }
      const request = fallbackNotification(settings, endsAt, bell === "armed", label, deps.now())
      const notificationId = request ? await deps.scheduleNotification(request) : null
      return { notificationId, bell }
    },
    /** The rest was skipped or paused before its end. */
    cancel() {
      if (deps.bell) quietly(() => deps.bell!.disarm())
    },
    /** The bell was switched off: end the audio session right away. */
    release() {
      if (deps.bell) quietly(() => deps.bell!.release())
    },
  }
}

export type RestAlert = ReturnType<typeof createRestAlert>
