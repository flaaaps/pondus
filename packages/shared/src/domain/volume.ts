import type { MuscleSlug } from "./muscles"
import { MUSCLE_SLUGS } from "./muscles"
import type { ExerciseRef, PlanDraft, SetType } from "./types"

export function emptyMuscleRecord(): Record<MuscleSlug, number> {
  const out = {} as Record<MuscleSlug, number>
  for (const m of MUSCLE_SLUGS) out[m] = 0
  return out
}

/** Weekly working sets per muscle: primary = 1 set, secondary = credit (default 0.5). */
export function weeklySetsByMuscle(
  plan: Pick<PlanDraft, "sessions">,
  lookup: (id: string) => ExerciseRef | undefined,
  secondaryCredit = 0.5,
): Record<MuscleSlug, number> {
  const out = emptyMuscleRecord()
  for (const s of plan.sessions) {
    for (const ex of s.exercises) {
      const ref = lookup(ex.exerciseId)
      if (!ref) continue
      for (const m of ref.primaryMuscles) out[m] += ex.targetSets
      for (const m of ref.secondaryMuscles) out[m] += ex.targetSets * secondaryCredit
    }
  }
  for (const m of MUSCLE_SLUGS) out[m] = Math.round(out[m] * 10) / 10
  return out
}

export const COUNTS_AS_WORKING: Record<SetType, boolean> = {
  warmup: false,
  working: true,
  drop: true,
  superset: true,
  failure: true,
  backoff: true,
}

export interface LoggedSet {
  setType: SetType
  weightGrams: number | null
  reps: number | null
  completed: boolean
}

/** Tonnage in grams across completed working sets. Bodyweight sets with null weight count 0. */
export function tonnageGrams(sets: LoggedSet[]): number {
  let total = 0
  for (const s of sets) {
    if (!s.completed || !COUNTS_AS_WORKING[s.setType]) continue
    total += (s.weightGrams ?? 0) * (s.reps ?? 0)
  }
  return total
}

export function workingSetCount(sets: LoggedSet[]): number {
  return sets.filter(s => s.completed && COUNTS_AS_WORKING[s.setType]).length
}

export function totalReps(sets: LoggedSet[]): number {
  return sets.filter(s => s.completed && COUNTS_AS_WORKING[s.setType]).reduce((a, s) => a + (s.reps ?? 0), 0)
}
