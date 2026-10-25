import type { WorkoutDto } from "@pondus/shared"
import { kv } from "./db"

const KEY = "active_workout"
const FOCUS_KEY = "active_workout_focus"
const SUMMARY_KEY = "last_completed_workout"

/** Where the lifter is in the active workout; kept apart from the DTO, which the server copy replaces. */
export interface ActiveWorkoutFocus {
  workoutKey: string
  focusedExerciseKey: string | null
  rirPendingSetKey: string | null
}

export const activeWorkoutStorage = {
  load: () => kv.get<WorkoutDto>(KEY),
  save: (w: WorkoutDto) => kv.set(KEY, w),
  clear: () => {
    kv.delete(KEY)
    kv.delete(FOCUS_KEY)
  },
  loadFocus: () => kv.get<ActiveWorkoutFocus>(FOCUS_KEY),
  saveFocus: (f: ActiveWorkoutFocus) => kv.set(FOCUS_KEY, f),
  /** The last completed workout, kept locally until the server summary is available. */
  loadLastCompleted: () => kv.get<WorkoutDto>(SUMMARY_KEY),
  saveLastCompleted: (w: WorkoutDto) => kv.set(SUMMARY_KEY, w),
}
