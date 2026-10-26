import type { WorkoutDto, WorkoutExerciseDto } from "@pondus/shared"
import { keyOf } from "./selectors"

/**
 * "Nur heute tauschen" bookkeeping. A stand-in carries `replacesWorkoutExerciseId`
 * (id or client id of the exercise it replaced, which is skipped meanwhile). Pure,
 * so the swap-back and restore flows are unit-tested without the store.
 */

const refersTo = (ex: WorkoutExerciseDto, ref: string | null | undefined) => !!ref && (ex.id === ref || ex.clientId === ref)

/** The exercise `standIn` replaced today, if it is still part of the workout. */
export function originalOf(w: WorkoutDto, standIn: WorkoutExerciseDto): WorkoutExerciseDto | null {
  return w.exercises.find(e => e !== standIn && refersTo(e, standIn.replacesWorkoutExerciseId)) ?? null
}

/** The stand-in that replaced `ex` today (the most recent one, if it was swapped more than once). */
export function replacementOf(w: WorkoutDto, ex: WorkoutExerciseDto): WorkoutExerciseDto | null {
  const candidates = w.exercises.filter(e => e !== ex && refersTo(ex, e.replacesWorkoutExerciseId))
  return candidates.length ? candidates[candidates.length - 1]! : null
}

export const hasLoggedSets = (ex: WorkoutExerciseDto) => ex.sets.some(s => s.completed)

/**
 * What restoring a skipped exercise does to its stand-in: nothing when there is none or
 * when sets were already logged on it (then both stay), otherwise the stand-in goes.
 */
export function restorePlan(w: WorkoutDto, ex: WorkoutExerciseDto): { restore: WorkoutExerciseDto; remove: WorkoutExerciseDto | null } {
  const standIn = replacementOf(w, ex)
  return { restore: ex, remove: standIn && !standIn.skipped && !hasLoggedSets(standIn) ? standIn : null }
}

/**
 * What "Zurück zu <Original>" on a stand-in does: the original comes back; the stand-in
 * is dropped unless sets were logged on it, in which case it is kept (skipped) for the record.
 */
export function swapBackPlan(w: WorkoutDto, standIn: WorkoutExerciseDto): { restore: WorkoutExerciseDto; remove: WorkoutExerciseDto | null; skip: WorkoutExerciseDto | null } | null {
  const original = originalOf(w, standIn)
  if (!original) return null
  const keep = hasLoggedSets(standIn)
  return { restore: original, remove: keep ? null : standIn, skip: keep ? standIn : null }
}

/** An exercise can be removed outright when nothing was logged on it. */
export const canRemove = (ex: WorkoutExerciseDto) => !hasLoggedSets(ex)

/** Key of the exercise to focus after `removed` left the visible list: the next one, else the previous, else none. */
export function focusAfterRemoval(visibleBefore: WorkoutExerciseDto[], removed: WorkoutExerciseDto): string | null {
  const idx = visibleBefore.findIndex(e => keyOf(e) === keyOf(removed))
  const rest = visibleBefore.filter((_, i) => i !== idx)
  if (!rest.length) return null
  const next = rest[Math.min(idx, rest.length - 1)]!
  return keyOf(next)
}
