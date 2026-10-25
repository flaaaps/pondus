import { describe, expect, it } from "vitest"
import { accumulateBests, detectRecords, emptyBests, estimateOneRepMaxGrams, recommendProgression, tonnageGrams, type PerformedSet } from "../src"

const w = (weightGrams: number, reps: number, rir: number | null = 2): PerformedSet => ({ setType: "working", weightGrams, reps, rir, completed: true })
const target = { repsMin: 8, repsMax: 12, targetRir: 1, targetSets: 3 }

describe("recommendProgression", () => {
  it("has no recommendation without data", () => {
    expect(recommendProgression(target, [], 2500).action).toBe("insufficient_data")
  })
  it("suggests a small increase when all sets hit the top of the range with reserve", () => {
    const r = recommendProgression(target, [{ performedAt: "2026-10-20T10:00:00Z", sets: [w(60000, 12), w(60000, 12), w(60000, 12)] }], 2500)
    expect(r.action).toBe("increase")
    expect(r.suggestedWeightGrams).toBe(62500)
    expect(r.suggestedReps).toBe(8)
  })
  it("holds when reps are inside the range", () => {
    const r = recommendProgression(target, [{ performedAt: "2026-10-20T10:00:00Z", sets: [w(60000, 12), w(60000, 10), w(60000, 9)] }], 2500)
    expect(r.action).toBe("add_reps")
    expect(r.suggestedWeightGrams).toBe(60000)
  })
  it("does not increase when RIR is below target", () => {
    const r = recommendProgression(target, [{ performedAt: "2026-10-20T10:00:00Z", sets: [w(60000, 12, 0), w(60000, 12, 0)] }], 2500)
    expect(r.action).toBe("add_reps")
  })
  it("steps down after two sessions under the minimum", () => {
    const r = recommendProgression(
      target,
      [
        { performedAt: "2026-10-22T10:00:00Z", sets: [w(80000, 6), w(80000, 5)] },
        { performedAt: "2026-10-19T10:00:00Z", sets: [w(80000, 7), w(80000, 6)] },
      ],
      2500,
    )
    expect(r.action).toBe("decrease")
    expect(r.suggestedWeightGrams).toBe(77500)
  })
  it("adds reps for bodyweight work", () => {
    const r = recommendProgression(target, [{ performedAt: "2026-10-20T10:00:00Z", sets: [w(0, 12), w(0, 12)] }], 0)
    expect(r.action).toBe("add_reps")
  })
  it("ignores warm-up and incomplete sets", () => {
    const sets: PerformedSet[] = [{ setType: "warmup", weightGrams: 100000, reps: 5, rir: null, completed: true }, w(60000, 12), { ...w(70000, 12), completed: false }]
    const r = recommendProgression(target, [{ performedAt: "2026-10-20T10:00:00Z", sets }], 2500)
    expect(r.lastWeightGrams).toBe(60000)
  })
})

describe("records", () => {
  it("estimates 1RM only for ≤ 12 reps", () => {
    expect(estimateOneRepMaxGrams(100000, 1)).toBe(100000)
    expect(estimateOneRepMaxGrams(100000, 5)).toBe(116667)
    expect(estimateOneRepMaxGrams(100000, 15)).toBeNull()
  })
  it("detects new max weight and reps-at-weight records", () => {
    const prev = accumulateBests(emptyBests(), [w(80000, 8), w(80000, 8)])
    const events = detectRecords(prev, [w(82500, 8), w(80000, 10)])
    const types = events.map(e => e.type)
    expect(types).toContain("max_weight")
    expect(types).toContain("max_reps_at_weight")
    expect(events.find(e => e.type === "estimated_1rm")?.isEstimate).toBe(true)
  })
  it("does not report records for the very first session except max weight", () => {
    const events = detectRecords(emptyBests(), [w(50000, 10)])
    expect(events.map(e => e.type)).toEqual(["max_weight"])
  })
  it("tonnage ignores warm-ups", () => {
    expect(tonnageGrams([{ setType: "warmup", weightGrams: 40000, reps: 10, completed: true }, { setType: "working", weightGrams: 60000, reps: 10, completed: true }])).toBe(600000)
  })
})
