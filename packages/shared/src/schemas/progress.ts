import { z } from "zod"
import { RECORD_TYPES } from "../domain/records"

export const rangeQuery = z.object({
  range: z.enum(["4w", "8w", "12w", "6m", "1y", "all"]).default("12w"),
})
export const progressOverviewDto = z.object({
  workoutsThisWeek: z.number().int(),
  plannedThisWeek: z.number().int(),
  workoutsLast4Weeks: z.number().int(),
  currentStreakWeeks: z.number().int(),
  totalWorkouts: z.number().int(),
  lastWorkout: z
    .object({ id: z.uuid(), name: z.string(), completedAt: z.string(), durationSeconds: z.number().int().nullable(), tonnageGrams: z.number().int(), workingSets: z.number().int() })
    .nullable(),
  recentRecords: z.array(z.object({ exerciseId: z.uuid().nullable(), exerciseName: z.string(), type: z.enum(RECORD_TYPES), valueGrams: z.number().int().nullable(), reps: z.number().int().nullable(), weightGrams: z.number().int().nullable(), achievedAt: z.string(), isEstimate: z.boolean() })),
  weeklyVolume: z.array(z.object({ weekStart: z.string(), tonnageGrams: z.number().int(), workingSets: z.number().int(), workouts: z.number().int(), durationSeconds: z.number().int() })),
  muscleDistribution: z.array(z.object({ muscle: z.string(), workingSets: z.number() })),
  /**
   * This week's working sets per muscle (primary = 1, secondary = 0.5, completed workouts only)
   * vs. the weekly target of the active plan's current version. Muscles with neither are omitted.
   */
  muscleWeeklySets: z
    .array(z.object({ muscle: z.string(), label: z.string(), actualSets: z.number(), targetSets: z.number() }))
    .optional(),
})
export type ProgressOverviewDto = z.infer<typeof progressOverviewDto>

export const exerciseProgressDto = z.object({
  exerciseId: z.uuid(),
  exerciseName: z.string(),
  points: z.array(z.object({ workoutId: z.uuid(), performedAt: z.string(), topWeightGrams: z.number().int(), topReps: z.number().int(), estimated1rmGrams: z.number().int().nullable(), tonnageGrams: z.number().int(), workingSets: z.number().int() })),
  bests: z.object({ maxWeightGrams: z.number().int(), maxSetVolumeGrams: z.number().int(), maxSessionVolumeGrams: z.number().int(), estimated1rmGrams: z.number().int() }),
  recommendation: z
    .object({ action: z.enum(["increase", "hold", "add_reps", "decrease", "insufficient_data"]), suggestedWeightGrams: z.number().int().nullable(), suggestedReps: z.number().int(), lastWeightGrams: z.number().int().nullable(), reason: z.string() })
    .nullable(),
})
export type ExerciseProgressDto = z.infer<typeof exerciseProgressDto>

export const personalRecordDto = z.object({
  id: z.uuid(),
  exerciseId: z.uuid().nullable(),
  exerciseName: z.string(),
  type: z.enum(RECORD_TYPES),
  valueGrams: z.number().int().nullable(),
  reps: z.number().int().nullable(),
  weightGrams: z.number().int().nullable(),
  achievedAt: z.string(),
  workoutId: z.uuid().nullable(),
  isEstimate: z.boolean(),
})
