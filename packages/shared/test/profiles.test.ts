import { describe, expect, it } from "vitest"
import { ENVIRONMENT_EQUIPMENT, MUSCLE_SLUGS, generatePlan, libraryAsRefs, weeklySetCaps, weeklySetTargets, type TrainingProfile } from "../src"

/**
 * The three profiles from the UX report (Abschnitt 5). Run with PRINT_PROFILES=1
 * to print weekly sets per muscle and the session contents.
 */
const refs = libraryAsRefs()
const byId = new Map(refs.map(r => [r.id, r]))
const base: TrainingProfile = {
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
}
export const REPORT_PROFILES: [string, TrainingProfile][] = [
  ["Anfänger 3× GK", { ...base, experienceLevel: "beginner", weeklyFrequency: 3 }],
  ["Fortgeschritten 4× OU", { ...base }],
  ["Fortgeschritten 4× OU Fokus Brust/Rücken", { ...base, musclePriorities: [{ muscle: "chest", priority: 1 }, { muscle: "back", priority: 2 }] }],
]

const print = process.env.PRINT_PROFILES === "1"

describe("report profiles", () => {
  for (const [name, p] of REPORT_PROFILES) {
    const plan = generatePlan(p, refs)
    const targets = weeklySetTargets(p)
    const caps = weeklySetCaps(targets)
    const all = plan.sessions.flatMap(s => s.exercises.map(e => ({ s, e, ref: byId.get(e.exerciseId)! })))

    if (print) {
      console.log(`\n## ${name}`)
      for (const s of plan.sessions) {
        console.log(`  ${s.name} (${s.estimatedDurationMinutes} min)`)
        for (const e of s.exercises)
          console.log(`    ${e.sequence}. ${e.exerciseId} ${e.targetSets}×${e.targetRepsMin}-${e.targetRepsMax} RIR ${e.targetRir} W${e.warmupSets} [${byId.get(e.exerciseId)!.movementPattern}]`)
      }
      console.log("  " + MUSCLE_SLUGS.map(m => `${m} ${plan.weeklySets[m]}/${targets[m]}`).join(" · "))
    }

    it(`${name}: no muscle exceeds its weekly cap`, () => {
      for (const m of MUSCLE_SLUGS) expect(plan.weeklySets[m], m).toBeLessThanOrEqual(caps[m])
    })
    it(`${name}: major muscles reach ≥ 75 % of target`, () => {
      for (const m of ["chest", "back", "quads", "hamstrings", "glutes", "shoulders"] as const)
        expect(plan.weeklySets[m], m).toBeGreaterThanOrEqual(targets[m] * 0.75)
    })
    it(`${name}: contains leg curl, lateral raise, core and calves`, () => {
      const patterns = new Set(all.map(x => x.ref.movementPattern))
      expect(patterns.has("knee_flexion")).toBe(true)
      expect(all.some(x => x.ref.movementPattern === "shoulder_abduction" && x.ref.category === "isolation")).toBe(true)
      expect(all.some(x => x.ref.category === "core")).toBe(true)
      expect(patterns.has("plantar_flexion")).toBe(true)
    })
    it(`${name}: no plan-wide redundancy (pullovers/shrugs once, no repeated hinge accessory, no upright row)`, () => {
      expect(all.filter(x => x.ref.movementPattern === "shoulder_flexion").length).toBeLessThanOrEqual(1)
      expect(all.some(x => x.ref.slug === "upright-row")).toBe(false)
      expect(all.filter(x => x.ref.slug === "cable-pull-through").length).toBeLessThanOrEqual(1)
      for (const s of plan.sessions) {
        const ids = s.exercises.map(e => e.exerciseId)
        expect(new Set(ids).size).toBe(ids.length)
      }
    })
    it(`${name}: sibling sessions start with different main lifts`, () => {
      const groups = new Map<string, string[][]>()
      for (const s of plan.sessions) {
        const key = s.name.replace(/ [A-D]\+?$/, "")
        const mains = s.exercises.filter(e => byId.get(e.exerciseId)!.category === "compound").slice(0, 2).map(e => e.exerciseId)
        groups.set(key, [...(groups.get(key) ?? []), mains])
      }
      for (const [, lists] of groups) {
        for (let i = 1; i < lists.length; i++) for (const id of lists[i]!) expect(lists[0]!).not.toContain(id)
      }
    })
    it(`${name}: prescriptions (warm-ups per family, hip isolation 8–15, beginner RIR ≥ 2)`, () => {
      for (const { e, ref } of all) {
        if (ref.category !== "compound") expect(e.warmupSets, ref.slug).toBe(0)
        if (["hip_extension", "hip_abduction", "hip_adduction"].includes(ref.movementPattern)) {
          expect(e.targetRepsMin, ref.slug).toBe(8)
          expect(e.targetRepsMax, ref.slug).toBe(15)
        }
        if (p.experienceLevel === "beginner") expect(e.targetRir, ref.slug).toBeGreaterThanOrEqual(2)
      }
      for (const s of plan.sessions) expect(s.exercises.filter(e => e.warmupSets > 0).length).toBeLessThanOrEqual(4)
    })
  }
})
