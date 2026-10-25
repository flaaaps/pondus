import { IDLE_REST_TIMER, restoreRestTimer, type RestTimerSnapshot } from "../rest-timer-snapshot"

const running = (endsAt: number): RestTimerSnapshot => ({ endsAt, durationSeconds: 90, remainingWhenPaused: null, notificationId: "n1", label: "Bankdrücken" })

describe("restoreRestTimer", () => {
  it("brings back a rest that is still running", () => {
    expect(restoreRestTimer(running(10_000), 5_000)).toEqual(running(10_000))
  })
  it("drops a rest that ran out while the app was gone", () => {
    expect(restoreRestTimer(running(10_000), 10_000)).toEqual(IDLE_REST_TIMER)
    expect(restoreRestTimer(running(10_000), 60_000)).toEqual(IDLE_REST_TIMER)
  })
  it("keeps a paused rest regardless of the time", () => {
    const paused: RestTimerSnapshot = { endsAt: null, durationSeconds: 90, remainingWhenPaused: 42, notificationId: null, label: null }
    expect(restoreRestTimer(paused, 1e12)).toEqual(paused)
  })
  it("is idle without a saved rest", () => {
    expect(restoreRestTimer(null, 0)).toEqual(IDLE_REST_TIMER)
    expect(restoreRestTimer(IDLE_REST_TIMER, 0)).toEqual(IDLE_REST_TIMER)
  })
})
