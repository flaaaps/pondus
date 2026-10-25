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
  weeklySetCaps,
  weeklySetTargets,
  assignRequiredSlots,
  splitTemplate,
  prescriptionForExercise,
  SPLIT_LABELS,
  scoreExercise,
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

describe("planner balance (SHARED-1/2/3)", () => {
  const caps = (p: TrainingProfile) => weeklySetCaps(weeklySetTargets(p))

  it("respects the weekly cap (big muscles hard in a full gym, ≤ 1 set over with limited equipment)", () => {
    const BIG = ["chest", "back", "quads", "hamstrings", "glutes"] as const
    for (const weeklyFrequency of [1, 2, 3, 4, 5, 6])
      for (const experienceLevel of ["beginner", "intermediate", "advanced"] as const)
        for (const env of ["full_gym", "limited_gym", "home"] as const)
          for (const musclePriorities of [[], [{ muscle: "glutes" as const, priority: 1 }], [{ muscle: "chest" as const, priority: 1 }, { muscle: "back" as const, priority: 2 }]]) {
            const p = profile({ weeklyFrequency, experienceLevel, environment: env, availableEquipment: ENVIRONMENT_EQUIPMENT[env], musclePriorities })
            const plan = generatePlan(p, refs)
            const c = caps(p)
            for (const m of MUSCLE_SLUGS) {
              const label = `${weeklyFrequency}× ${experienceLevel} ${env} focus=${musclePriorities.length} ${m}`
              const big = (BIG as readonly string[]).includes(m)
              // Secondary credit (squats → abs, rows → forearms) can push small muscles slightly over.
              const tolerance = big ? (env === "full_gym" ? 0 : 1) : 3
              expect(plan.weeklySets[m], label).toBeLessThanOrEqual(c[m] + tolerance)
            }
          }
  })

  it("glutes without focus stay near target (report: 16–18 vs. 8)", () => {
    const p = profile({ experienceLevel: "beginner", weeklyFrequency: 3 })
    const plan = generatePlan(p, refs)
    expect(plan.weeklySets.glutes).toBeLessThanOrEqual(caps(p).glutes)
    expect(plan.weeklySets.glutes).toBeLessThanOrEqual(10)
  })

  it("glute focus still gets more glute volume than no focus", () => {
    const base = generatePlan(profile(), refs)
    const focus = generatePlan(profile({ musclePriorities: [{ muscle: "glutes", priority: 1 }] }), refs)
    expect(focus.weeklySets.glutes).toBeGreaterThan(base.weeklySets.glutes)
  })

  it("assigns mandatory slots per split and spreads them over the week", () => {
    const fb = assignRequiredSlots(splitTemplate("full_body", 3, "hypertrophy", "beginner"))
    const count = (key: string) => fb.flat().filter(s => s.key === key).length
    expect(count("knee_flexion")).toBe(2)
    expect(count("lateral_raise")).toBe(2)
    expect(count("core")).toBe(2)
    expect(count("calves")).toBe(1)
    expect(Math.max(...fb.map(s => s.length)) - Math.min(...fb.map(s => s.length))).toBeLessThanOrEqual(1)
    const ul = splitTemplate("upper_lower", 4, "hypertrophy", "intermediate")
    const slots = assignRequiredSlots(ul)
    ul.sessions.forEach((s, i) => {
      const keys = slots[i]!.map(x => x.key).sort()
      expect(keys).toEqual(s.kind === "upper" ? ["lateral_raise"] : ["calves", "core", "knee_flexion"])
    })
  })

  it("every split contains a leg curl, lateral raise and core exercise (incl. PPL and home)", () => {
    for (const [splitType, f] of [["push_pull_legs", 3], ["push_pull_legs", 6], ["upper_lower", 4], ["full_body", 2]] as const) {
      for (const env of ["full_gym", "limited_gym"] as const) {
        const plan = generatePlan(profile({ weeklyFrequency: f, environment: env, availableEquipment: ENVIRONMENT_EQUIPMENT[env] }), refs, { splitType })
        const all = plan.sessions.flatMap(s => s.exercises.map(e => byId.get(e.exerciseId)!))
        expect(all.some(e => e.movementPattern === "knee_flexion"), `${splitType} ${f} ${env} leg curl`).toBe(true)
        expect(all.some(e => e.movementPattern === "shoulder_abduction" && e.category === "isolation"), `${splitType} ${f} ${env} lateral`).toBe(true)
        expect(all.some(e => e.category === "core"), `${splitType} ${f} ${env} core`).toBe(true)
      }
    }
  })

  it("upper sessions contain no lower-body hinge (rack pulls) and at most one pullover/shrug per week", () => {
    const plan = generatePlan(profile({ musclePriorities: [{ muscle: "chest", priority: 1 }, { muscle: "back", priority: 2 }] }), refs)
    for (const s of plan.sessions.filter(s => s.name.startsWith("Oberkörper")))
      for (const e of s.exercises) expect(byId.get(e.exerciseId)!.movementPattern, e.exerciseId).not.toBe("hinge")
    const pullovers = plan.sessions.flatMap(s => s.exercises).filter(e => byId.get(e.exerciseId)!.movementPattern === "shoulder_flexion")
    expect(pullovers.length).toBeLessThanOrEqual(1)
  })

  it("A/B sessions of the same kind use different main lifts", () => {
    const plan = generatePlan(profile(), refs)
    const mains = (name: string) =>
      plan.sessions.find(s => s.name === name)!.exercises.filter(e => byId.get(e.exerciseId)!.category === "compound").map(e => e.exerciseId)
    for (const [a, b] of [["Oberkörper A", "Oberkörper B"], ["Unterkörper A", "Unterkörper B"]] as const) {
      const shared = mains(a).filter(id => mains(b).includes(id))
      expect(shared, `${a}/${b}`).toEqual([])
    }
  })

  it("upright row (barbell) is not a default pick but stays allowed when preferred", () => {
    for (const f of [3, 4, 5, 6]) {
      const plan = generatePlan(profile({ weeklyFrequency: f }), refs)
      expect(plan.sessions.flatMap(s => s.exercises.map(e => e.exerciseId))).not.toContain("upright-row")
    }
    const ctx = (preferred: string[]) => ({
      targetMuscle: "shoulders" as const,
      focusMuscles: new Set<never>(),
      preferred: new Set(preferred),
      excluded: new Set<string>(),
      continuity: new Set<string>(),
      familiar: new Set<string>(),
      availableEquipment: new Set(ENVIRONMENT_EQUIPMENT.full_gym),
      experience: "intermediate" as const,
      sessionPatterns: new Set<never>(),
      sessionExerciseIds: new Set<string>(),
      planExerciseIds: new Set<string>(),
      wantCompound: true,
      discouragedSlugs: new Set(["upright-row"]),
    })
    const upright = byId.get("upright-row")!
    expect(scoreExercise(upright, ctx(["upright-row"]))! - scoreExercise(upright, ctx([]))!).toBeGreaterThan(6)
  })

  it("warm-ups only on the first compound of each movement family", () => {
    for (const f of [3, 4, 6]) {
      const plan = generatePlan(profile({ weeklyFrequency: f }), refs)
      for (const s of plan.sessions) {
        const families = new Set<string>()
        let first = true
        for (const e of s.exercises) {
          const ref = byId.get(e.exerciseId)!
          if (e.warmupSets === 0) continue
          expect(ref.category).toBe("compound")
          const fam = ref.movementPattern.includes("push") ? "push" : ref.movementPattern.includes("pull") ? "pull" : ref.movementPattern
          expect(families.has(fam), `${s.name} ${ref.slug}`).toBe(false)
          families.add(fam)
          expect(e.warmupSets).toBe(first ? 2 : 1)
          first = false
        }
      }
    }
  })

  it("prescriptions: hip isolation 8–15, beginner RIR ≥ 2", () => {
    const thrust = byId.get("barbell-hip-thrust")!
    expect(prescriptionForExercise(thrust, "hypertrophy", "intermediate")).toMatchObject({ repsMin: 8, repsMax: 15 })
    expect(prescriptionForExercise(byId.get("cable-pull-through")!, "hypertrophy", "intermediate")).toMatchObject({ repsMin: 8, repsMax: 15 })
    expect(prescriptionForExercise(byId.get("hip-abduction-machine")!, "general_fitness", "beginner")).toMatchObject({ repsMin: 8, repsMax: 15, rir: 2 })
    expect(prescriptionForExercise(byId.get("cable-fly")!, "hypertrophy", "beginner").rir).toBe(2)
    expect(prescriptionForExercise(byId.get("cable-fly")!, "hypertrophy", "intermediate").rir).toBe(1)
    expect(prescriptionForExercise(byId.get("barbell-back-squat")!, "strength", "intermediate")).toMatchObject({ repsMin: 3, repsMax: 6 })
  })
})

describe("split labels (SHARED-4)", () => {
  it("adjustment diff uses German labels instead of enum values", () => {
    const current = generatePlan(profile({ weeklyFrequency: 3 }), refs)
    const { diff } = proposeAdjustedPlan(current, profile({ weeklyFrequency: 4 }), refs)
    expect(diff.summary).toContain("Aufteilung: Ganzkörper → Ober-/Unterkörper.")
    expect(diff.summary.join(" ")).not.toMatch(/full_body|upper_lower/)
    expect(SPLIT_LABELS.push_pull_legs).toBe("Push/Pull/Legs")
  })
})
