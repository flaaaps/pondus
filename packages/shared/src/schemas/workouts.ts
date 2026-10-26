import { z } from "zod"
import { SET_TYPES } from "../domain/types"
import { RECORD_TYPES } from "../domain/records"
import { setExerciseNoteBody } from "./exercises"
import { idempotencyKey, isoDateTime, paginationQuery, reps, rir, rpe, weightGrams } from "./common"

export const setType = z.enum(SET_TYPES)
export const workoutStatus = z.enum(["in_progress", "paused", "completed", "cancelled"])

export const workoutSetDto = z.object({
  id: z.uuid(),
  clientId: z.string().nullable(),
  setNumber: z.number().int(),
  setType,
  weightGrams: weightGrams.nullable(),
  reps: reps.nullable(),
  rir: rir.nullable(),
  rpe: rpe.nullable(),
  completed: z.boolean(),
  completedAt: z.string().nullable(),
  notes: z.string().nullable(),
  /** Planned values copied from the plan at start, for display. */
  targetWeightGrams: weightGrams.nullable(),
  targetReps: reps.nullable(),
})
export const workoutExerciseDto = z.object({
  id: z.uuid(),
  clientId: z.string().nullable(),
  exerciseId: z.uuid().nullable(),
  exerciseNameSnapshot: z.string(),
  sequence: z.number().int(),
  targetSets: z.number().int().nullable(),
  targetRepsMin: z.number().int().nullable(),
  targetRepsMax: z.number().int().nullable(),
  restSeconds: z.number().int().nullable(),
  targetRir: z.number().int().nullable(),
  skipped: z.boolean(),
  notes: z.string().nullable(),
  /** The exercise this one stands in for today ("nur heute tauschen"); that one is skipped. Id or client id. */
  replacesWorkoutExerciseId: z.string().nullable().optional(),
  /**
   * Progression targets computed at workout start (domain `nextTargets`), null for exercises
   * without a rep range (free/added without targets) or older workouts. Per-set targets are in
   * `sets[].targetWeightGrams/targetReps` (working sets prefilled with them).
   * For `assisted` exercises weights are assistance (lower = harder).
   */
  nextTarget: z
    .object({
      kind: z.enum(["increase_load", "increase_reps", "hold", "deload", "no_data"]),
      weightGrams: z.number().int().nullable(),
      repsPerSet: z.array(z.number().int()),
      targetRir: z.number().int().nullable(),
      lastWeightGrams: z.number().int().nullable(),
      basedOn: z.string().nullable(),
      reason: z.string(),
    })
    .nullable()
    .optional(),
  sets: z.array(workoutSetDto),
  /** Last performance of this exercise before this workout (for prefill/comparison). */
  previous: z
    .object({
      performedAt: z.string(),
      sets: z.array(z.object({ setType, weightGrams: weightGrams.nullable(), reps: reps.nullable(), rir: rir.nullable() })),
    })
    .nullable(),
})
export const workoutDto = z.object({
  id: z.uuid(),
  clientId: z.string().nullable(),
  status: workoutStatus,
  name: z.string(),
  trainingPlanId: z.uuid().nullable(),
  trainingPlanVersionId: z.uuid().nullable(),
  sourceSessionId: z.uuid().nullable(),
  /** Stable key of the source plan session (survives plan versions). */
  sourceSessionKey: z.uuid().nullable().optional(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  pausedAt: z.string().nullable(),
  /** Accumulated paused seconds so duration excludes pauses. */
  pausedSeconds: z.number().int(),
  durationSeconds: z.number().int().nullable(),
  notes: z.string().nullable(),
  exercises: z.array(workoutExerciseDto),
  updatedAt: z.string(),
})
export type WorkoutDto = z.infer<typeof workoutDto>
export type WorkoutExerciseDto = z.infer<typeof workoutExerciseDto>
export type WorkoutSetDto = z.infer<typeof workoutSetDto>

export const startWorkoutBody = z.object({
  clientId: idempotencyKey,
  source: z.discriminatedUnion("type", [
    z.object({ type: z.literal("plan_session"), planSessionId: z.uuid() }),
    z.object({ type: z.literal("repeat_workout"), workoutId: z.uuid() }),
    z.object({ type: z.literal("empty"), name: z.string().trim().min(1).max(60).optional() }),
    /** Started offline: the client owns the exercise list (sent as add_exercise mutations); the server only links the plan session. */
    z.object({ type: z.literal("plan_session_client"), planSessionId: z.uuid(), name: z.string().trim().min(1).max(60) }),
  ]),
  startedAt: isoDateTime.optional(),
})

export const addWorkoutExerciseBody = z.object({
  clientId: idempotencyKey,
  exerciseId: z.uuid(),
  targetSets: z.number().int().min(1).max(12).optional(),
  targetRepsMin: z.number().int().min(1).max(100).optional(),
  targetRepsMax: z.number().int().min(1).max(100).optional(),
  restSeconds: z.number().int().min(0).max(900).optional(),
  targetRir: z.number().int().min(0).max(10).nullable().optional(),
  warmupSets: z.number().int().min(0).max(5).optional(),
  sequence: z.number().int().min(1).optional(),
  /** Replace an existing exercise in this workout only (its id or client id). The old one is marked skipped. */
  replacesWorkoutExerciseId: z.string().min(1).optional(),
})
export const updateWorkoutExerciseBody = z.object({
  skipped: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
  sequence: z.number().int().min(1).optional(),
  restSeconds: z.number().int().min(0).max(900).optional(),
})

export const upsertSetBody = z.object({
  /** Client-generated id; the same id updates the same set (idempotent). */
  clientId: idempotencyKey,
  setNumber: z.number().int().min(1).max(50),
  setType: setType.default("working"),
  weightGrams: weightGrams.nullable().default(null),
  reps: reps.nullable().default(null),
  rir: rir.nullable().default(null),
  rpe: rpe.nullable().default(null),
  completed: z.boolean().default(false),
  completedAt: isoDateTime.nullable().default(null),
  notes: z.string().max(300).nullable().default(null),
  /** Client-side modification time; the server keeps the newest version. */
  updatedAt: isoDateTime,
})
export type UpsertSetBody = z.infer<typeof upsertSetBody>

export const updateWorkoutBody = z.object({
  notes: z.string().max(1000).nullable().optional(),
  name: z.string().trim().min(1).max(60).optional(),
})
export const pauseResumeBody = z.object({ at: isoDateTime.optional() })
export const completeWorkoutBody = z.object({
  completedAt: isoDateTime.optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export const recordEventDto = z.object({
  type: z.enum(RECORD_TYPES),
  exerciseId: z.uuid().nullable(),
  exerciseName: z.string(),
  valueGrams: z.number().int().nullable(),
  reps: z.number().int().nullable(),
  weightGrams: z.number().int().nullable(),
  previousValue: z.number().nullable(),
  isEstimate: z.boolean(),
})
export const workoutSummaryDto = z.object({
  workout: workoutDto,
  durationSeconds: z.number().int(),
  exercisesCompleted: z.number().int(),
  workingSets: z.number().int(),
  totalReps: z.number().int(),
  tonnageGrams: z.number().int(),
  records: z.array(recordEventDto),
  comparison: z
    .object({
      workoutId: z.uuid(),
      completedAt: z.string(),
      durationSeconds: z.number().int().nullable(),
      workingSets: z.number().int(),
      tonnageGrams: z.number().int(),
    })
    .nullable(),
})
export type WorkoutSummaryDto = z.infer<typeof workoutSummaryDto>

export const workoutHistoryQuery = paginationQuery.extend({
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  exerciseId: z.uuid().optional(),
  status: workoutStatus.optional(),
})

/** Offline sync: a batch of client mutations replayed in order. */
export const syncMutation = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("start_workout"), body: startWorkoutBody }),
  z.object({ kind: z.literal("add_exercise"), workoutClientId: z.string(), body: addWorkoutExerciseBody }),
  z.object({ kind: z.literal("update_exercise"), workoutClientId: z.string(), exerciseClientId: z.string(), body: updateWorkoutExerciseBody }),
  /** Drops an exercise (and its sets) from the workout, e.g. a stand-in that was swapped back. */
  z.object({ kind: z.literal("remove_exercise"), workoutClientId: z.string(), exerciseClientId: z.string() }),
  z.object({ kind: z.literal("upsert_set"), workoutClientId: z.string(), exerciseClientId: z.string(), body: upsertSetBody }),
  z.object({ kind: z.literal("delete_set"), workoutClientId: z.string(), setClientId: z.string() }),
  z.object({ kind: z.literal("pause"), workoutClientId: z.string(), body: pauseResumeBody }),
  z.object({ kind: z.literal("resume"), workoutClientId: z.string(), body: pauseResumeBody }),
  z.object({ kind: z.literal("complete"), workoutClientId: z.string(), body: completeWorkoutBody }),
  z.object({ kind: z.literal("cancel"), workoutClientId: z.string() }),
  /** Not tied to a workout: the user's lasting note on an exercise, queued so it can be edited offline. */
  z.object({ kind: z.literal("set_exercise_note"), exerciseId: z.uuid(), body: setExerciseNoteBody.required({ updatedAt: true }) }),
])
export type SyncMutation = z.infer<typeof syncMutation>
export const syncBody = z.object({ mutations: z.array(syncMutation).min(1).max(500) })
export const syncResultDto = z.object({
  applied: z.number().int(),
  results: z.array(z.object({ index: z.number().int(), status: z.enum(["applied", "duplicate", "conflict", "error"]), message: z.string().optional() })),
  workouts: z.array(workoutDto),
})
