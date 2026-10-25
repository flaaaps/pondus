import type { MuscleSlug } from "./muscles"
import { MUSCLE_SLUGS } from "./muscles"
import type { ExerciseRef, LoadType, PlanDraft, SetType } from "./types"

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
  /** Load type of the exercise; `assisted` sets log assistance, not load. Omitted = plain load. */
  loadType?: LoadType
}

/**
 * The load actually moved in a set, in grams.
 * - `assisted`: body weight minus assistance, or `null` when body weight is unknown
 *   (assistance alone is *not* a load: more assistance = less work).
 * - everything else: the logged weight (bodyweight exercises: added weight, 0 if none).
 */
export function effectiveLoadGrams(weightGrams: number | null, loadType?: LoadType, bodyweightGrams?: number | null): number | null {
  if (loadType === "assisted") {
    if (!bodyweightGrams || bodyweightGrams <= 0) return null
    return Math.max(0, bodyweightGrams - (weightGrams ?? 0))
  }
  return weightGrams ?? 0
}

/**
 * Tonnage in grams across completed working sets. Bodyweight sets with null weight count 0.
 * Assisted sets count body weight − assistance when `bodyweightGrams` is known, otherwise 0
 * (never the assistance itself).
 */
export function tonnageGrams(sets: LoggedSet[], opts: { bodyweightGrams?: number | null } = {}): number {
  let total = 0
  for (const s of sets) {
    if (!s.completed || !COUNTS_AS_WORKING[s.setType]) continue
    total += (effectiveLoadGrams(s.weightGrams, s.loadType, opts.bodyweightGrams) ?? 0) * (s.reps ?? 0)
  }
  return total
}

export function workingSetCount(sets: LoggedSet[]): number {
  return sets.filter(s => s.completed && COUNTS_AS_WORKING[s.setType]).length
}

export function totalReps(sets: LoggedSet[]): number {
  return sets.filter(s => s.completed && COUNTS_AS_WORKING[s.setType]).reduce((a, s) => a + (s.reps ?? 0), 0)
}
