import { createActivityController, FINISHED_VISIBLE_MS, type ActivityFactory, type ActivityHandle, type ActivityLinkStorage } from "../controller"
import type { WorkoutActivityProps } from "../props"

const props = (p: Partial<WorkoutActivityProps> = {}): WorkoutActivityProps => ({
  workoutKey: "w1",
  status: "running",
  title: "Bankdrücken",
  progress: "Übung 1 von 1 · Satz 1 von 3",
  progressShort: "1/1 · Satz 1/3",
  setShort: "1/3",
  target: "80 kg × 8",
  last: null,
  durationStartMs: 0,
  durationText: null,
  rest: null,
  restPausedText: null,
  ...p,
})

let ids = 0
function fakeHandle(id = `a${++ids}`) {
  return { getId: () => id, update: jest.fn(async () => undefined), end: jest.fn(async () => undefined) } satisfies ActivityHandle
}
function setup(opts: { instances?: ReturnType<typeof fakeHandle>[]; link?: { activityId: string; workoutKey: string } | null; foreground?: boolean; startThrows?: boolean } = {}) {
  const started: ReturnType<typeof fakeHandle>[] = []
  const factory: ActivityFactory = {
    start: jest.fn(() => {
      if (opts.startThrows) throw new Error("Live Activities are disabled")
      const h = fakeHandle()
      started.push(h)
      return h
    }),
    getInstances: () => opts.instances ?? [],
  }
  let link = opts.link ?? null
  const links: ActivityLinkStorage = { load: () => link, save: l => (link = l), clear: () => (link = null) }
  const state = { foreground: opts.foreground ?? true }
  const onStartFailed = jest.fn()
  const controller = createActivityController({ factory, links, now: () => 1_000, canStart: () => state.foreground, onStartFailed, onStarted: jest.fn() })
  return { controller, factory, started, links: () => link, state, onStartFailed }
}

describe("activity controller", () => {
  it("starts exactly once and links the activity to the workout", async () => {
    const t = setup()
    await t.controller.sync({ kind: "active", props: props() })
    await t.controller.sync({ kind: "active", props: props() })
    expect(t.factory.start).toHaveBeenCalledTimes(1)
    expect(t.factory.start).toHaveBeenCalledWith(props(), "pondus://workout/w1", undefined)
    expect(t.links()).toEqual({ activityId: t.started[0]!.getId(), workoutKey: "w1" })
  })
  it("sends updates only when the props change, with the rest end as stale date", async () => {
    const t = setup()
    await t.controller.sync({ kind: "active", props: props() })
    await t.controller.sync({ kind: "active", props: props() })
    expect(t.started[0]!.update).not.toHaveBeenCalled()
    const resting = props({ rest: { startMs: 0, endMs: 90_000 } })
    await t.controller.sync({ kind: "active", props: resting })
    expect(t.started[0]!.update).toHaveBeenCalledWith(resting, new Date(90_000))
  })
  it("does not start in the background, but once the app is in front", async () => {
    const t = setup({ foreground: false })
    await t.controller.sync({ kind: "active", props: props() })
    expect(t.factory.start).not.toHaveBeenCalled()
    t.state.foreground = true
    await t.controller.sync({ kind: "active", props: props() })
    expect(t.factory.start).toHaveBeenCalledTimes(1)
  })
  it("ends immediately when the workout is gone or the feature is off", async () => {
    const t = setup()
    await t.controller.sync({ kind: "active", props: props() })
    await t.controller.sync({ kind: "none" })
    expect(t.started[0]!.end).toHaveBeenCalledWith("immediate", undefined)
    expect(t.links()).toBeNull()
  })
  it("shows the summary after completion and lets iOS remove it later", async () => {
    const t = setup()
    await t.controller.sync({ kind: "active", props: props() })
    const summary = props({ status: "finished", title: "Workout beendet" })
    await t.controller.sync({ kind: "finished", props: summary })
    expect(t.started[0]!.end).toHaveBeenCalledWith({ after: new Date(1_000 + FINISHED_VISIBLE_MS) }, summary)
  })
  it("replaces the activity of another workout", async () => {
    const t = setup()
    await t.controller.sync({ kind: "active", props: props() })
    await t.controller.sync({ kind: "active", props: props({ workoutKey: "w2" }) })
    expect(t.started[0]!.end).toHaveBeenCalledWith("immediate", undefined)
    expect(t.started).toHaveLength(2)
  })
  it("adopts its own activity after a restart and ends strangers", async () => {
    const own = fakeHandle("own")
    const stranger = fakeHandle("stranger")
    const t = setup({ instances: [stranger, own], link: { activityId: "own", workoutKey: "w1" } })
    await t.controller.sync({ kind: "active", props: props() })
    expect(stranger.end).toHaveBeenCalledWith("immediate", undefined)
    expect(own.end).not.toHaveBeenCalled()
    expect(t.factory.start).not.toHaveBeenCalled()
    expect(own.update).toHaveBeenCalledWith(props(), undefined)
  })
  it("ends a leftover activity of an old workout after a restart", async () => {
    const old = fakeHandle("old")
    const t = setup({ instances: [old], link: { activityId: "old", workoutKey: "w0" } })
    await t.controller.sync({ kind: "active", props: props() })
    expect(old.end).toHaveBeenCalledWith("immediate", undefined)
    expect(t.factory.start).toHaveBeenCalledTimes(1)
  })
  it("reports a failed start once and retries only when asked", async () => {
    const t = setup({ startThrows: true })
    await t.controller.sync({ kind: "active", props: props() })
    await t.controller.sync({ kind: "active", props: props({ title: "Rudern" }) })
    expect(t.factory.start).toHaveBeenCalledTimes(1)
    expect(t.onStartFailed).toHaveBeenCalledTimes(1)
    t.controller.retryStart()
    await t.controller.sync({ kind: "active", props: props() })
    expect(t.factory.start).toHaveBeenCalledTimes(2)
  })
  it("starts a fresh activity when the old one can no longer be updated", async () => {
    const t = setup()
    await t.controller.sync({ kind: "active", props: props() })
    t.started[0]!.update.mockRejectedValueOnce(new Error("not found"))
    await t.controller.sync({ kind: "active", props: props({ title: "Rudern" }) })
    await t.controller.sync({ kind: "active", props: props({ title: "Rudern" }) })
    expect(t.started).toHaveLength(2)
  })
})
