import { DEFAULT_HEURISTICS, type PlanningHeuristics } from "./heuristics"
import type { ExerciseRef, PlanExerciseDraft } from "./types"

/** Estimate how long a session takes, in minutes. */
export function estimateSessionMinutes(
  exercises: PlanExerciseDraft[],
  lookup: (id: string) => ExerciseRef | undefined,
  h: PlanningHeuristics = DEFAULT_HEURISTICS,
): number {
  let seconds = h.duration.sessionOverheadSeconds
  for (const ex of exercises) {
    const ref = lookup(ex.exerciseId)
    const setSeconds = ref?.setSeconds ?? h.duration.setSecondsDefault[ref?.category ?? "isolation"]
    // Rest is taken after every working set except the last one of the exercise.
    seconds += ex.targetSets * setSeconds + Math.max(0, ex.targetSets - 1) * ex.restSeconds
    seconds += ex.warmupSets * (h.duration.warmupSetSeconds + 45)
    seconds += h.duration.exerciseTransitionSeconds
  }
  return Math.round(seconds / 60)
}
