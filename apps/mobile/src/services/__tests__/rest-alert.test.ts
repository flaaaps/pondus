import { BELL_GRACE_MS, BELL_LINGER_MS, BELL_SOUND_FILE, createRestAlert, fallbackNotification, keepNotificationOnFinish, restNotificationId, shouldTryBell, type BellPort, type RestAlertSettings, type RestNotificationRequest } from "../rest-alert"
import type { BellArmResult } from "../../../modules/rest-bell"

const NOW = 1_800_000_000_000
const ENDS_AT = NOW + 90_000
const ON: RestAlertSettings = { notifications: true, bell: true, bellVolume: 0.7, bellDuck: true }

function fakeBell({ headphones = true, available = true, arm = "armed" as BellArmResult | Error } = {}) {
  const calls: string[] = []
  const bell: BellPort = {
    isAvailable: () => available,
    headphonesConnected: () => headphones,
    arm: jest.fn((endsAt: number) => {
      calls.push(`arm ${endsAt}`)
      return arm instanceof Error ? Promise.reject(arm) : Promise.resolve(arm)
    }),
    disarm: jest.fn(() => {
      calls.push("disarm")
      return Promise.resolve()
    }),
    release: jest.fn(() => {
      calls.push("release")
      return Promise.resolve()
    }),
  }
  return { bell, calls }
}

function setup(bell: BellPort | null, settings: RestAlertSettings = ON) {
  const scheduled: RestNotificationRequest[] = []
  const alert = createRestAlert({
    bell,
    settings: () => settings,
    now: () => NOW,
    scheduleNotification: async r => {
      scheduled.push(r)
      return r.identifier
    },
  })
  return { alert, scheduled }
}

describe("shouldTryBell", () => {
  it("needs the setting, the sound and headphones", () => {
    expect(shouldTryBell(ON, { available: true, headphones: true })).toBe(true)
    expect(shouldTryBell(ON, { available: true, headphones: false })).toBe(false)
    expect(shouldTryBell(ON, { available: false, headphones: true })).toBe(false)
    expect(shouldTryBell({ ...ON, bell: false }, { available: true, headphones: true })).toBe(false)
  })
})

describe("fallbackNotification", () => {
  it("comes at the end with the default sound when the bell is not armed", () => {
    expect(fallbackNotification(ON, ENDS_AT, false, "Squat", NOW)).toEqual({ identifier: restNotificationId(ENDS_AT), seconds: 90, sound: "default", label: "Squat" })
  })
  it("comes after the grace time with the bell sound when the bell is armed", () => {
    expect(fallbackNotification(ON, ENDS_AT, true, null, NOW)).toEqual({ identifier: restNotificationId(ENDS_AT), seconds: 90 + BELL_GRACE_MS / 1000, sound: BELL_SOUND_FILE, label: null })
  })
  it("is never due in less than a second", () => {
    expect(fallbackNotification(ON, NOW - 5000, false, null, NOW)?.seconds).toBe(1)
  })
  it("is skipped when notifications are off", () => {
    expect(fallbackNotification({ ...ON, notifications: false }, ENDS_AT, true, null, NOW)).toBeNull()
  })
})

describe("keepNotificationOnFinish", () => {
  it("drops the notification in front of the app and keeps it in the background", () => {
    expect(keepNotificationOnFinish(true)).toBe(false)
    expect(keepNotificationOnFinish(false)).toBe(true)
  })
})

describe("createRestAlert.schedule", () => {
  it("with headphones arms the bell first, then schedules the delayed fallback it can remove", async () => {
    const { bell, calls } = fakeBell()
    const { alert, scheduled } = setup(bell)
    await expect(alert.schedule(ENDS_AT, "Squat")).resolves.toEqual({ notificationId: restNotificationId(ENDS_AT), bell: "armed" })
    expect(bell.arm).toHaveBeenCalledWith(ENDS_AT, 0.7, true, restNotificationId(ENDS_AT), BELL_LINGER_MS)
    expect(calls).toEqual([`arm ${ENDS_AT}`])
    expect(scheduled).toEqual([{ identifier: restNotificationId(ENDS_AT), seconds: 93, sound: BELL_SOUND_FILE, label: "Squat" }])
  })

  it("without headphones keeps the old behaviour and cancels a bell left from an earlier rest", async () => {
    const { bell, calls } = fakeBell({ headphones: false })
    const { alert, scheduled } = setup(bell)
    await expect(alert.schedule(ENDS_AT, null)).resolves.toEqual({ notificationId: restNotificationId(ENDS_AT), bell: "off" })
    expect(calls).toEqual(["disarm"])
    expect(scheduled[0]).toMatchObject({ seconds: 90, sound: "default" })
  })

  it.each<BellArmResult>(["no-headphones", "session-failed", "too-late", "missing-sound"])("falls back to the plain notification when arming says %s", async result => {
    const { bell } = fakeBell({ arm: result })
    const { alert, scheduled } = setup(bell)
    await expect(alert.schedule(ENDS_AT, null)).resolves.toMatchObject({ bell: result })
    expect(scheduled[0]).toMatchObject({ seconds: 90, sound: "default" })
  })

  it("treats a throwing native call as a failed session", async () => {
    const { bell } = fakeBell({ arm: new Error("boom") })
    const { alert, scheduled } = setup(bell)
    await expect(alert.schedule(ENDS_AT, null)).resolves.toMatchObject({ bell: "session-failed" })
    expect(scheduled[0]).toMatchObject({ seconds: 90, sound: "default" })
  })

  it("does not try the bell when it is switched off or the sound is missing", async () => {
    for (const [opts, settings] of [[{}, { ...ON, bell: false }], [{ available: false }, ON]] as const) {
      const { bell } = fakeBell(opts)
      const { alert, scheduled } = setup(bell, settings)
      await alert.schedule(ENDS_AT, null)
      expect(bell.arm).not.toHaveBeenCalled()
      expect(scheduled[0]).toMatchObject({ sound: "default" })
    }
  })

  it("works without the native module (Jest, Expo Go, older dev client)", async () => {
    const { alert, scheduled } = setup(null)
    await expect(alert.schedule(ENDS_AT, null)).resolves.toEqual({ notificationId: restNotificationId(ENDS_AT), bell: "off" })
    expect(scheduled[0]).toMatchObject({ seconds: 90, sound: "default" })
    expect(() => alert.cancel()).not.toThrow()
  })

  it("with notifications off rings the bell only and gives it nothing to remove", async () => {
    const { bell } = fakeBell()
    const { alert, scheduled } = setup(bell, { ...ON, notifications: false })
    await expect(alert.schedule(ENDS_AT, null)).resolves.toEqual({ notificationId: null, bell: "armed" })
    expect(bell.arm).toHaveBeenCalledWith(ENDS_AT, 0.7, true, null, BELL_LINGER_MS)
    expect(scheduled).toEqual([])
  })

  it("issues the arm call synchronously, so a cancel right after reaches the native side later", () => {
    const { bell, calls } = fakeBell()
    const { alert } = setup(bell)
    void alert.schedule(ENDS_AT, null)
    alert.cancel()
    expect(calls).toEqual([`arm ${ENDS_AT}`, "disarm"])
  })

  it("passes the ducking setting through", async () => {
    const { bell } = fakeBell()
    await setup(bell, { ...ON, bellDuck: false }).alert.schedule(ENDS_AT, null)
    expect(bell.arm).toHaveBeenCalledWith(ENDS_AT, 0.7, false, restNotificationId(ENDS_AT), BELL_LINGER_MS)
  })

  it("release ends the session", () => {
    const { bell, calls } = fakeBell()
    setup(bell).alert.release()
    expect(calls).toEqual(["release"])
  })
})
