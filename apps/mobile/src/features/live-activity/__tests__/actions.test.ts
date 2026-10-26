import { createActivityActionHandler, type ActivityActionDeps } from "../actions"

function setup(p: Partial<{ activityId: string | null; shownRir: string | null; pendingRir: string | null; restSet: boolean }> = {}) {
  const deps = {
    currentActivityId: () => (p.activityId === undefined ? "a1" : p.activityId),
    shownRirSetKey: () => p.shownRir ?? null,
    pendingRirSetKey: () => p.pendingRir ?? null,
    restSet: () => p.restSet ?? false,
    completeNextSet: jest.fn(),
    stopRest: jest.fn(),
    setRir: jest.fn(),
  } satisfies ActivityActionDeps
  return { deps, handle: createActivityActionHandler(deps) }
}
const tap = (target: string, timestamp = 10_000, source = "a1") => ({ source, target, timestamp })

describe("activity actions", () => {
  it("ticks off the next set", () => {
    const { deps, handle } = setup()
    expect(handle(tap("complete-set"))).toBe("done")
    expect(deps.completeNextSet).toHaveBeenCalledTimes(1)
  })
  it("counts a double tap on 'Satz ✓' once, a later tap again", () => {
    const { deps, handle } = setup()
    handle(tap("complete-set", 10_000))
    expect(handle(tap("complete-set", 10_400))).toBe("repeat")
    expect(handle(tap("complete-set", 11_500))).toBe("done")
    expect(deps.completeNextSet).toHaveBeenCalledTimes(2)
  })
  it("ignores taps on another (stale) activity", () => {
    const { deps, handle } = setup()
    expect(handle(tap("complete-set", 10_000, "old"))).toBe("stale")
    expect(setup({ activityId: null }).handle(tap("complete-set"))).toBe("stale")
    expect(deps.completeNextSet).not.toHaveBeenCalled()
  })
  it("ticks off the next set during a rest too (iOS may show the rest look past its end)", () => {
    const { deps, handle } = setup({ restSet: true })
    expect(handle(tap("complete-set"))).toBe("done")
    expect(deps.completeNextSet).toHaveBeenCalledTimes(1)
  })
  it("skips a running rest", () => {
    const { deps, handle } = setup({ restSet: true })
    expect(handle(tap("rest-done"))).toBe("done")
    expect(deps.stopRest).toHaveBeenCalledTimes(1)
  })
  it("also clears a rest that ran out before iOS marked the activity stale", () => {
    const { deps, handle } = setup({ restSet: true })
    expect(handle(tap("rest-done"))).toBe("done")
    expect(deps.stopRest).toHaveBeenCalledTimes(1)
  })
  it("has nothing to skip without a rest", () => {
    const { deps, handle } = setup()
    expect(handle(tap("rest-done"))).toBe("ignored")
    expect(handle(tap("rest-plus-15"))).toBe("ignored")
    expect(deps.stopRest).not.toHaveBeenCalled()
  })
  it("answers the RIR question that is shown, '4+' as 4", () => {
    const { deps, handle } = setup({ shownRir: "s2", pendingRir: "s2" })
    expect(handle(tap("rir-4"))).toBe("done")
    expect(deps.setRir).toHaveBeenCalledWith("s2", 4)
  })
  it("drops a RIR tap without a matching open question", () => {
    expect(setup({ shownRir: "s2", pendingRir: null }).handle(tap("rir-2"))).toBe("stale")
    const replaced = setup({ shownRir: "s2", pendingRir: "s3" })
    expect(replaced.handle(tap("rir-2"))).toBe("stale")
    expect(replaced.deps.setRir).not.toHaveBeenCalled()
  })
  it("counts quick RIR taps once", () => {
    const { deps, handle } = setup({ shownRir: "s2", pendingRir: "s2" })
    handle(tap("rir-2", 10_000))
    expect(handle(tap("rir-3", 10_300))).toBe("repeat")
    expect(deps.setRir).toHaveBeenCalledTimes(1)
  })
  it("does not take the second half of a double tap on 'Satz ✓' as a RIR answer", () => {
    const { deps, handle } = setup({ shownRir: "s2", pendingRir: "s2" })
    handle(tap("complete-set", 10_000))
    expect(handle(tap("rir-0", 10_300))).toBe("repeat")
    expect(deps.setRir).not.toHaveBeenCalled()
    expect(handle(tap("rir-0", 11_200))).toBe("done")
  })
  it("ignores unknown targets", () => {
    expect(setup().handle(tap("something"))).toBe("ignored")
  })
})
