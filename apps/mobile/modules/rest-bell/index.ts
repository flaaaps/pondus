import { requireOptionalNativeModule } from "expo"

/** Why `arm` did or did not schedule the bell (see ios/RestBellModule.swift). */
export type BellArmResult = "armed" | "no-headphones" | "missing-sound" | "too-late" | "session-failed"
/** What happened at the end of an armed rest. Only "played" removes the fallback notification. */
export type BellOutcome = "played" | "no-headphones" | "late" | "failed"

export interface RestBellEvents {
  onBell: (e: { endsAt: number; outcome: BellOutcome }) => void
  onRouteChange: (e: { headphonesConnected: boolean }) => void
}

export interface RestBellModule {
  /** The bell sound is in the app bundle. */
  isAvailable(): boolean
  /** Wired, USB-C or Bluetooth output (AirPods included; Bluetooth speakers look the same to iOS). */
  headphonesConnected(): boolean
  /**
   * Rings at `endsAt` (Unix ms) if headphones are still connected then (with `duck`, other audio is
   * turned down for the length of the bell), and removes the pending
   * notification `notificationId` once the bell plays. Keeps a silent, mixable audio session alive
   * until then and for `lingerMs` after it. Must first be called while the app is in the foreground.
   */
  arm(endsAt: number, volume: number, duck: boolean, notificationId: string | null, lingerMs: number): Promise<BellArmResult>
  /** Cancels a scheduled bell; the session lingers. */
  disarm(): Promise<void>
  /** Cancels the bell and ends the audio session now. */
  release(): Promise<void>
  addListener<E extends keyof RestBellEvents>(event: E, listener: RestBellEvents[E]): { remove(): void }
}

/** `null` in Jest, Expo Go or a dev client built before this module existed. */
export const RestBell = requireOptionalNativeModule<RestBellModule>("PondusRestBell")
