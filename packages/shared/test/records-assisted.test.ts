import { describe, expect, it } from "vitest"
import {
  EXERCISE_LIBRARY,
  accumulateBests,
  detectRecords,
  effectiveLoadGrams,
  emptyBests,
  estimateSetOneRepMaxGrams,
  hasBestsHistory,
  tonnageGrams,
  type PerformedSet,
} from "../src"

const w = (weightGrams: number, reps: number): PerformedSet => ({ setType: "working", weightGrams, reps, rir: 2, completed: true })
const assisted = { loadType: "assisted" as const }

describe("assisted exercises", () => {
  it("library marks assisted pull-ups and dips as assisted", () => {
    const bySlug = new Map(EXERCISE_LIBRARY.map(e => [e.slug, e]))
    expect(bySlug.get("assisted-pull-up")?.loadType).toBe("assisted")
    expect(bySlug.get("assisted-dip")?.loadType).toBe("assisted")
  })

  it("never reports weight, volume or e1RM records for assisted exercises", () => {
    const prev = accumulateBests(emptyBests(), [w(30000, 8), w(30000, 8)], assisted)
    // Less assistance (harder) and more reps at the old assistance.
    const events = detectRecords(prev, [w(25000, 8), w(30000, 10)], assisted)
    expect(events.map(e => e.type)).toEqual(["max_reps_at_weight"])
    // More assistance must not become a "max weight" record either.
    expect(detectRecords(prev, [w(40000, 8)], assisted).map(e => e.type)).not.toContain("max_weight")
  })

  it("assisted bests only track reps per assistance", () => {
    const b = accumulateBests(emptyBests(), [w(30000, 8)], assisted)
    expect(b.maxWeightGrams).toBe(0)
    expect(b.maxSetVolumeGrams).toBe(0)
    expect(b.estimated1rmGrams).toBe(0)
    expect(b.repsAtWeight[30000]).toBe(8)
    expect(hasBestsHistory(b)).toBe(true)
  })

  it("first assisted session yields no records", () => {
    expect(detectRecords(emptyBests(), [w(30000, 8)], assisted)).toEqual([])
  })

  it("effective load, e1RM and tonnage use body weight minus assistance", () => {
    expect(effectiveLoadGrams(30000, "assisted", 80000)).toBe(50000)
    expect(effectiveLoadGrams(30000, "assisted")).toBeNull()
    expect(effectiveLoadGrams(30000, "machine")).toBe(30000)
    expect(estimateSetOneRepMaxGrams(30000, 5, "assisted", 80000)).toBe(58333)
    expect(estimateSetOneRepMaxGrams(30000, 5, "assisted")).toBeNull()
    const sets = [{ setType: "working" as const, weightGrams: 30000, reps: 10, completed: true, loadType: "assisted" as const }]
    expect(tonnageGrams(sets)).toBe(0)
    expect(tonnageGrams(sets, { bodyweightGrams: 80000 })).toBe(500000)
    // Unchanged for regular sets.
    expect(tonnageGrams([{ setType: "working", weightGrams: 60000, reps: 10, completed: true }])).toBe(600000)
  })

  it("regular exercises still get records from the second session on", () => {
    const prev = accumulateBests(emptyBests(), [w(80000, 8)])
    expect(detectRecords(prev, [w(82500, 8)]).map(e => e.type)).toContain("max_weight")
  })
})
