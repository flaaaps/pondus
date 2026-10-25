import { describe, expect, it } from "vitest"
import { incrementForExercise, nextTargets, recommendProgression, warmupLadder, type PerformedSet } from "../src"

const w = (weightGrams: number, reps: number, rir: number | null = 2): PerformedSet => ({ setType: "working", weightGrams, reps, rir, completed: true })
const presc = { repsMin: 8, repsMax: 12, targetRir: 1, targetSets: 3, incrementGrams: 2500 }
const at = (performedAt: string, sets: PerformedSet[]) => ({ performedAt, sets })

describe("nextTargets", () => {
  it("no history → no_data, reps at the bottom of the range", () => {
    const t = nextTargets(presc, [])
    expect(t).toMatchObject({ kind: "no_data", weightGrams: null, repsPerSet: [8, 8, 8], basedOn: null })
  })
  it("top of range with reserve → increase_load", () => {
    const t = nextTargets(presc, [at("2026-10-20T10:00:00Z", [w(60000, 12), w(60000, 12), w(60000, 12)])])
    expect(t).toMatchObject({ kind: "increase_load", weightGrams: 62500, repsPerSet: [8, 8, 8], lastWeightGrams: 60000, basedOn: "2026-10-20T10:00:00Z" })
  })
  it("inside range → increase_reps per set, capped at repsMax", () => {
    const t = nextTargets(presc, [at("2026-10-20T10:00:00Z", [w(60000, 12), w(60000, 10), w(60000, 9)])])
    expect(t.kind).toBe("increase_reps")
    expect(t.weightGrams).toBe(60000)
    expect(t.repsPerSet).toEqual([12, 11, 10])
  })
  it("fills missing sets when fewer were done than prescribed", () => {
    const t = nextTargets({ ...presc, targetSets: 4 }, [at("2026-10-20T10:00:00Z", [w(60000, 9), w(60000, 9)])])
    expect(t.repsPerSet).toHaveLength(4)
    expect(t.repsPerSet.slice(0, 2)).toEqual([10, 10])
  })
  it("too close to failure → hold at the last reps", () => {
    const t = nextTargets(presc, [at("2026-10-20T10:00:00Z", [w(60000, 10, 0), w(60000, 9, 0), w(60000, 9, 0)])])
    expect(t).toMatchObject({ kind: "hold", weightGrams: 60000, repsPerSet: [10, 9, 9] })
  })
  it("set to failure counts as RIR 0: top of range does not add load", () => {
    const f = (weightGrams: number, reps: number, rir: number | null = null): PerformedSet => ({ setType: "failure", weightGrams, reps, rir, completed: true })
    const t = nextTargets(presc, [at("2026-10-20T10:00:00Z", [w(60000, 12), w(60000, 12), f(60000, 12, 3)])])
    expect(t).toMatchObject({ kind: "hold", weightGrams: 60000 })
  })
  it("set to failure is ignored for RIR when no RIR target is set", () => {
    const f: PerformedSet = { setType: "failure", weightGrams: 60000, reps: 12, rir: null, completed: true }
    const t = nextTargets({ ...presc, targetRir: null }, [at("2026-10-20T10:00:00Z", [w(60000, 12), w(60000, 12), f])])
    expect(t.kind).toBe("increase_load")
  })
  it("drop sets don't drive progression", () => {
    const d: PerformedSet = { setType: "drop", weightGrams: 40000, reps: 6, rir: 0, completed: true }
    const t = nextTargets(presc, [at("2026-10-20T10:00:00Z", [w(60000, 12), w(60000, 12), w(60000, 12), d])])
    expect(t).toMatchObject({ kind: "increase_load", weightGrams: 62500 })
  })
  it("under range once → hold at repsMin", () => {
    const t = nextTargets(presc, [at("2026-10-20T10:00:00Z", [w(80000, 7), w(80000, 6)])])
    expect(t).toMatchObject({ kind: "hold", weightGrams: 80000, repsPerSet: [8, 8, 8] })
  })
  it("under range twice → deload one step", () => {
    const t = nextTargets(presc, [at("2026-10-22T10:00:00Z", [w(80000, 6), w(80000, 5)]), at("2026-10-19T10:00:00Z", [w(80000, 7), w(80000, 6)])])
    expect(t).toMatchObject({ kind: "deload", weightGrams: 77500, repsPerSet: [8, 8, 8] })
  })
  it("bodyweight topped out → increase_reps beyond the range", () => {
    const t = nextTargets({ ...presc, incrementGrams: 0 }, [at("2026-10-20T10:00:00Z", [w(0, 12), w(0, 12), w(0, 12)])])
    expect(t).toMatchObject({ kind: "increase_reps", weightGrams: 0, repsPerSet: [13, 13, 13] })
  })
  it("assisted: progression lowers the assistance, deload raises it", () => {
    const up = nextTargets(presc, [at("2026-10-20T10:00:00Z", [w(30000, 12), w(30000, 12), w(30000, 12)])], { loadType: "assisted" })
    expect(up).toMatchObject({ kind: "increase_load", weightGrams: 27500 })
    const down = nextTargets(presc, [at("2026-10-22T10:00:00Z", [w(30000, 6), w(30000, 5)]), at("2026-10-19T10:00:00Z", [w(30000, 7)])], { loadType: "assisted" })
    expect(down).toMatchObject({ kind: "deload", weightGrams: 32500 })
    // Top set for assisted = least assistance.
    expect(recommendProgression(presc, [at("2026-10-20T10:00:00Z", [w(30000, 9), w(35000, 12)])], 2500, { loadType: "assisted" }).lastWeightGrams).toBe(30000)
  })
  it("rounds the suggested load when a rounding step is given", () => {
    const t = nextTargets({ ...presc, incrementGrams: 2000, roundingStepGrams: 2500 }, [at("2026-10-20T10:00:00Z", [w(60000, 12), w(60000, 12), w(60000, 12)])])
    expect(t.weightGrams).toBe(62500)
  })
  it("incrementForExercise follows equipment and load type", () => {
    expect(incrementForExercise({ loadType: "free_weight", equipment: ["barbell", "bench"] })).toBe(2500)
    expect(incrementForExercise({ loadType: "free_weight", equipment: ["dumbbell"] })).toBe(2000)
    expect(incrementForExercise({ loadType: "bodyweight", equipment: ["pull_up_bar"] })).toBe(0)
    expect(incrementForExercise({ loadType: "assisted", equipment: ["machine"] })).toBe(2500)
  })
})

describe("warmupLadder", () => {
  it("40/60/80 % rounded to the step", () => {
    expect(warmupLadder(100000, 2500)).toEqual([
      { percent: 0.4, weightGrams: 40000, reps: 8 },
      { percent: 0.6, weightGrams: 60000, reps: 5 },
      { percent: 0.8, weightGrams: 80000, reps: 3 },
    ])
    expect(warmupLadder(62500, 2500).map(s => s.weightGrams)).toEqual([25000, 37500, 50000])
  })
  it("respects the empty bar and drops duplicates / steps at working weight", () => {
    expect(warmupLadder(40000, 2500, { minWeightGrams: 20000 }).map(s => s.weightGrams)).toEqual([20000, 25000, 32500])
    expect(warmupLadder(25000, 2500, { minWeightGrams: 20000 }).map(s => s.weightGrams)).toEqual([20000])
    expect(warmupLadder(5000, 2500).map(s => s.weightGrams)).toEqual([2500])
  })
  it("shorter ladders for 1–2 warm-up sets, none for bodyweight", () => {
    expect(warmupLadder(100000, 2500, { sets: 1 }).map(s => s.percent)).toEqual([0.6])
    expect(warmupLadder(100000, 2500, { sets: 2 }).map(s => s.weightGrams)).toEqual([50000, 80000])
    expect(warmupLadder(0, 2500)).toEqual([])
  })
})

describe("assisted with unlogged sets (regression)", () => {
  const set = (weightGrams: number | null, reps: number): PerformedSet => ({ setType: "working", weightGrams, reps, rir: 2, completed: true })
  it("ignores sets without a logged assistance instead of reading them as 0 kg", () => {
    const t = nextTargets({ repsMin: 6, repsMax: 10, targetRir: 2, targetSets: 4, incrementGrams: 2500 }, [at("2026-10-25T11:49:39Z", [set(2500, 6), set(null, 6), set(40000, 6), set(null, 6)])], { loadType: "assisted" })
    expect(t.kind).toBe("increase_reps")
    expect(t.weightGrams).toBe(2500)
    expect(t.lastWeightGrams).toBe(2500)
  })
  it("no logged assistance at all → no_data, not 0 kg", () => {
    const t = nextTargets({ repsMin: 6, repsMax: 10, targetRir: 2, targetSets: 2, incrementGrams: 2500 }, [at("2026-10-25T11:49:39Z", [set(null, 8), set(null, 8)])], { loadType: "assisted" })
    expect(t.kind).toBe("no_data")
    expect(t.weightGrams).toBeNull()
  })
  it("0 kg logged assistance stays a real value", () => {
    const t = nextTargets({ repsMin: 6, repsMax: 10, targetRir: 2, targetSets: 2, incrementGrams: 2500 }, [at("2026-10-25T11:49:39Z", [set(0, 7), set(5000, 8)])], { loadType: "assisted" })
    expect(t.weightGrams).toBe(0)
  })
})

describe("SET_VOLUME_CREDIT", () => {
  it("drop sets count half, warm-ups nothing", async () => {
    const { SET_VOLUME_CREDIT } = await import("../src")
    expect(SET_VOLUME_CREDIT).toMatchObject({ warmup: 0, working: 1, drop: 0.5, failure: 1 })
  })
})
