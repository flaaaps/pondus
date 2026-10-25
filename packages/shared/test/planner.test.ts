import { describe, expect, it } from "vitest"
import {
  ENVIRONMENT_EQUIPMENT,
  EXERCISE_LIBRARY,
  MUSCLE_SLUGS,
  generatePlan,
  libraryAsRefs,
  proposeAdjustedPlan,
  rankAlternatives,
  moveSession,
  weeklySetsByMuscle,
  type TrainingProfile,
} from "../src"

const refs = libraryAsRefs()
const byId = new Map(refs.map(r => [r.id, r]))

function profile(overrides: Partial<TrainingProfile> = {}): TrainingProfile {
  return {
    primaryGoal: "hypertrophy",
    secondaryGoals: [],
    experienceLevel: "intermediate",
    sessionDurationMinutes: 60,
    weeklyFrequency: 4,
    environment: "full_gym",
    availableEquipment: ENVIRONMENT_EQUIPMENT.full_gym,
    musclePriorities: [],
    preferredExerciseIds: [],
    excludedExerciseIds: [],
    ...overrides,
  }
}

describe("exercise library", () => {
  it("has at least 150 exercises with unique slugs and valid alternatives", () => {
    expect(EXERCISE_LIBRARY.length).toBeGreaterThanOrEqual(150)
    const slugs = new Set(EXERCISE_LIBRARY.map(e => e.slug))
    expect(slugs.size).toBe(EXERCISE_LIBRARY.length)
    for (const e of EXERCISE_LIBRARY) {
      expect(e.primaryMuscles.length, e.slug).toBeGreaterThan(0)
      for (const alt of e.alternatives) expect(slugs.has(alt), `${e.slug} → ${alt}`).toBe(true)
    }
  })
})

describe("generatePlan", () => {
  it("beginner, 3×/week → full body, fits the time budget, covers all major muscles", () => {
    const p = profile({ experienceLevel: "beginner", weeklyFrequency: 3, sessionDurationMinutes: 60 })
    const plan = generatePlan(p, refs)
    expect(plan.splitType).toBe("full_body")
    expect(plan.sessions).toHaveLength(3)
    for (const s of plan.sessions) {
      expect(s.estimatedDurationMinutes).toBeLessThanOrEqual(60)
      expect(s.exercises.length).toBeGreaterThanOrEqual(4)
      expect(s.exercises.length).toBeLessThanOrEqual(6)
      for (const e of s.exercises) expect(byId.get(e.exerciseId)?.difficulty).not.toBe("advanced")
    }
    for (const m of ["chest", "back", "quads", "hamstrings", "shoulders"] as const) {
      expect(plan.weeklySets[m], m).toBeGreaterThanOrEqual(6)
    }
    expect(plan.rationale.length).toBeGreaterThan(3)
  })

  it("intermediate, 4×/week → upper/lower with two sessions per region", () => {
    const plan = generatePlan(profile({ weeklyFrequency: 4 }), refs)
    expect(plan.splitType).toBe("upper_lower")
    expect(plan.sessions).toHaveLength(4)
    const upper = plan.sessions.filter(s => s.name.startsWith("Oberkörper"))
    expect(upper).toHaveLength(2)
    for (const s of upper) expect(s.focusMuscles).not.toContain("quads")
  })

  it("is deterministic", () => {
    const a = generatePlan(profile(), refs)
    const b = generatePlan(profile(), refs)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it("prioritising chest and shoulders increases their weekly sets and moves them first", () => {
    const base = generatePlan(profile(), refs)
    const focused = generatePlan(
      profile({ musclePriorities: [{ muscle: "chest", priority: 1 }, { muscle: "shoulders", priority: 2 }] }),
      refs,
    )
    expect(focused.weeklySets.chest).toBeGreaterThan(base.weeklySets.chest)
    expect(focused.weeklySets.shoulders).toBeGreaterThan(base.weeklySets.shoulders)
    // Other muscles still get maintenance volume.
    expect(focused.weeklySets.back).toBeGreaterThanOrEqual(6)
    expect(focused.weeklySets.quads).toBeGreaterThanOrEqual(6)
    const upper = focused.sessions.find(s => s.name.startsWith("Oberkörper"))!
    const first = byId.get(upper.exercises[0]!.exerciseId)!
    expect(first.primaryMuscles).toContain("chest")
  })

  it("prefers preferred exercises without wrecking balance", () => {
    const plan = generatePlan(profile({ preferredExerciseIds: ["incline-dumbbell-bench-press", "hack-squat", "chin-up"] }), refs)
    const ids = new Set(plan.sessions.flatMap(s => s.exercises.map(e => e.exerciseId)))
    expect(ids.has("incline-dumbbell-bench-press")).toBe(true)
    expect(ids.has("hack-squat")).toBe(true)
    expect(ids.has("chin-up")).toBe(true)
    // Still has hamstrings & back volume.
    expect(plan.weeklySets.hamstrings).toBeGreaterThanOrEqual(6)
  })

  it("never includes excluded exercises", () => {
    const excluded = ["barbell-back-squat", "barbell-bench-press", "conventional-deadlift", "pull-up"]
    const plan = generatePlan(profile({ excludedExerciseIds: excluded }), refs)
    const ids = plan.sessions.flatMap(s => s.exercises.map(e => e.exerciseId))
    for (const x of excluded) expect(ids).not.toContain(x)
  })

  it("respects available equipment (home gym)", () => {
    const plan = generatePlan(profile({ environment: "home", availableEquipment: ENVIRONMENT_EQUIPMENT.home }), refs)
    const allowed = new Set(ENVIRONMENT_EQUIPMENT.home)
    for (const s of plan.sessions)
      for (const e of s.exercises) for (const eq of byId.get(e.exerciseId)!.equipment) expect(allowed.has(eq), e.exerciseId).toBe(true)
    expect(plan.sessions.every(s => s.exercises.length >= 3)).toBe(true)
  })

  it("reduces the plan when the time budget shrinks", () => {
    const long = generatePlan(profile({ sessionDurationMinutes: 90 }), refs)
    const short = generatePlan(profile({ sessionDurationMinutes: 40 }), refs)
    const sets = (p: typeof long) => p.sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.targetSets, 0), 0)
    expect(sets(short)).toBeLessThan(sets(long))
    for (const s of short.sessions) expect(s.estimatedDurationMinutes).toBeLessThanOrEqual(40)
  })

  it("does not schedule overlapping sessions back to back when the week allows it", () => {
    const plan = generatePlan(profile({ weeklyFrequency: 4 }), refs)
    const byDay = [...plan.sessions].sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0))
    for (let i = 1; i < byDay.length; i++) {
      const prev = byDay[i - 1]!
      const cur = byDay[i]!
      if ((cur.weekday ?? 0) - (prev.weekday ?? 0) === 1) {
        const shared = cur.focusMuscles.filter(m => prev.focusMuscles.includes(m))
        expect(shared.length, `${prev.name} → ${cur.name}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it("prescribes strength rep ranges for strength goals", () => {
    const plan = generatePlan(profile({ primaryGoal: "strength" }), refs)
    const compound = plan.sessions[0]!.exercises.find(e => byId.get(e.exerciseId)!.category === "compound")!
    expect(compound.targetRepsMax).toBeLessThanOrEqual(6)
    expect(compound.warmupSets).toBeGreaterThan(0)
  })
})

describe("plan adjustments", () => {
  it("increasing 3 → 4 keeps most exercises and adds a session", () => {
    const current = generatePlan(profile({ weeklyFrequency: 3 }), refs)
    const { proposal, diff } = proposeAdjustedPlan(current, profile({ weeklyFrequency: 4 }), refs)
    expect(proposal.sessions).toHaveLength(4)
    expect(diff.newFrequency).toBe(4)
    const oldIds = new Set(current.sessions.flatMap(s => s.exercises.map(e => e.exerciseId)))
    expect(diff.exercisesKept / oldIds.size).toBeGreaterThan(0.5)
    expect(diff.summary.length).toBeGreaterThan(0)
  })

  it("decreasing 4 → 3 reduces sessions and keeps the weekly volume in a sane range", () => {
    const current = generatePlan(profile({ weeklyFrequency: 4 }), refs)
    const { proposal, diff } = proposeAdjustedPlan(current, profile({ weeklyFrequency: 3 }), refs)
    expect(proposal.sessions).toHaveLength(3)
    expect(diff.newWeeklySetsTotal).toBeGreaterThan(diff.oldWeeklySetsTotal * 0.6)
    expect(diff.exercisesKept).toBeGreaterThan(4)
  })

  it("swap suggestions share the primary muscle and respect equipment", () => {
    const bench = byId.get("barbell-bench-press")!
    const alts = rankAlternatives(bench, refs, { availableEquipment: new Set(["machine", "cable", "dumbbell", "bench"]) })
    expect(alts.length).toBeGreaterThan(2)
    for (const a of alts) {
      expect(a.exercise.primaryMuscles).toContain("chest")
      expect(a.exercise.equipment).not.toContain("barbell")
    }
    expect(alts[0]!.exercise.slug).toMatch(/dumbbell-bench-press|machine-chest-press/)
  })

  it("moving a session changes only that session's weekday", () => {
    const plan = generatePlan(profile({ weeklyFrequency: 3 }), refs)
    const moved = moveSession(plan.sessions, 2, 6)
    expect(moved[1]!.weekday).toBe(6)
    expect(moved[0]!.weekday).toBe(plan.sessions[0]!.weekday)
    expect(moved[2]!.weekday).toBe(plan.sessions[2]!.weekday)
    expect(moved[1]!.exercises).toEqual(plan.sessions[1]!.exercises)
  })

  it("weekly set accounting counts warm-ups as zero and secondaries fractionally", () => {
    const plan = generatePlan(profile(), refs)
    const sets = weeklySetsByMuscle(plan, id => byId.get(id))
    for (const m of MUSCLE_SLUGS) expect(sets[m]).toBeGreaterThanOrEqual(0)
    const direct = plan.sessions.flatMap(s => s.exercises).filter(e => byId.get(e.exerciseId)!.primaryMuscles.includes("triceps")).reduce((a, e) => a + e.targetSets, 0)
    expect(sets.triceps).toBeGreaterThanOrEqual(direct)
  })
})
