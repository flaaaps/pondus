import type { WorkoutDto } from "@pondus/shared"
import { kv } from "./db"

const KEY = "active_workout"
const SUMMARY_KEY = "last_completed_workout"

export const activeWorkoutStorage = {
  load: () => kv.get<WorkoutDto>(KEY),
  save: (w: WorkoutDto) => kv.set(KEY, w),
  clear: () => kv.delete(KEY),
  /** The last completed workout, kept locally until the server summary is available. */
  loadLastCompleted: () => kv.get<WorkoutDto>(SUMMARY_KEY),
  saveLastCompleted: (w: WorkoutDto) => kv.set(SUMMARY_KEY, w),
}
