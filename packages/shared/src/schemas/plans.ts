import { z } from "zod"
import { MUSCLE_SLUGS } from "../domain/muscles"
import { SPLIT_TYPES } from "../domain/types"

export const splitType = z.enum(SPLIT_TYPES)

export const planExerciseDto = z.object({
  id: z.uuid(),
  exerciseId: z.uuid(),
  exerciseName: z.string(),
  sequence: z.number().int(),
  targetSets: z.number().int().min(1).max(12),
  targetRepsMin: z.number().int().min(1).max(100),
  targetRepsMax: z.number().int().min(1).max(100),
  restSeconds: z.number().int().min(0).max(900),
  targetRir: z.number().int().min(0).max(10).nullable(),
  warmupSets: z.number().int().min(0).max(5),
  notes: z.string().nullable(),
})
export const planSessionDto = z.object({
  id: z.uuid(),
  name: z.string(),
  sequence: z.number().int(),
  weekday: z.number().int().min(0).max(6).nullable(),
  focusMuscles: z.array(z.enum(MUSCLE_SLUGS as [string, ...string[]])),
  estimatedDurationMinutes: z.number().int(),
  exercises: z.array(planExerciseDto),
})
export const rationaleItem = z.object({ key: z.string(), title: z.string(), body: z.string() })
export const planVersionDto = z.object({
  id: z.uuid(),
  versionNumber: z.number().int(),
  splitType,
  weeklyFrequency: z.number().int(),
  weeklySets: z.record(z.string(), z.number()),
  rationale: z.array(rationaleItem),
  sessions: z.array(planSessionDto),
  createdAt: z.string(),
})
export const planDto = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(["active", "archived", "draft"]),
  currentVersion: planVersionDto,
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type PlanDto = z.infer<typeof planDto>
export type PlanVersionDto = z.infer<typeof planVersionDto>
export type PlanSessionDto = z.infer<typeof planSessionDto>
export type PlanExerciseDto = z.infer<typeof planExerciseDto>

export const planSummaryDto = planDto.omit({ currentVersion: true }).extend({
  splitType,
  weeklyFrequency: z.number().int(),
  versionNumber: z.number().int(),
})

export const generatePlanBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  splitType: splitType.optional(),
  activate: z.boolean().default(true),
})

/** Edit operations applied to a plan's current version → new version. */
const exerciseParams = z.object({
  targetSets: z.number().int().min(1).max(12).optional(),
  targetRepsMin: z.number().int().min(1).max(100).optional(),
  targetRepsMax: z.number().int().min(1).max(100).optional(),
  restSeconds: z.number().int().min(0).max(900).optional(),
  targetRir: z.number().int().min(0).max(10).nullable().optional(),
  warmupSets: z.number().int().min(0).max(5).optional(),
  notes: z.string().max(500).nullable().optional(),
})
export const planEditOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("rename_plan"), name: z.string().trim().min(1).max(80) }),
  z.object({ op: z.literal("rename_session"), sessionId: z.uuid(), name: z.string().trim().min(1).max(60) }),
  z.object({ op: z.literal("move_session"), sessionId: z.uuid(), weekday: z.number().int().min(0).max(6).nullable() }),
  z.object({ op: z.literal("reorder_sessions"), sessionIds: z.array(z.uuid()).min(1) }),
  z.object({ op: z.literal("add_session"), name: z.string().trim().min(1).max(60), weekday: z.number().int().min(0).max(6).nullable() }),
  z.object({ op: z.literal("remove_session"), sessionId: z.uuid() }),
  z.object({ op: z.literal("add_exercise"), sessionId: z.uuid(), exerciseId: z.uuid(), params: exerciseParams.optional() }),
  z.object({ op: z.literal("remove_exercise"), planExerciseId: z.uuid() }),
  z.object({ op: z.literal("duplicate_exercise"), planExerciseId: z.uuid() }),
  z.object({ op: z.literal("swap_exercise"), planExerciseId: z.uuid(), newExerciseId: z.uuid() }),
  z.object({ op: z.literal("update_exercise"), planExerciseId: z.uuid(), params: exerciseParams }),
  z.object({ op: z.literal("reorder_exercises"), sessionId: z.uuid(), planExerciseIds: z.array(z.uuid()).min(1) }),
])
export type PlanEditOp = z.infer<typeof planEditOp>
export const editPlanBody = z.object({ ops: z.array(planEditOp).min(1).max(50) })

export const planDiffDto = z.object({
  oldFrequency: z.number().int(),
  newFrequency: z.number().int(),
  oldSplit: z.string(),
  newSplit: z.string(),
  sessionsAdded: z.array(z.string()),
  sessionsRemoved: z.array(z.string()),
  exercisesAdded: z.array(z.object({ exerciseId: z.string(), name: z.string(), sessionName: z.string() })),
  exercisesRemoved: z.array(z.object({ exerciseId: z.string(), name: z.string(), sessionName: z.string() })),
  exercisesKept: z.number().int(),
  weeklySetsDelta: z.array(z.object({ muscle: z.string(), label: z.string(), before: z.number(), after: z.number() })),
  oldWeeklySetsTotal: z.number(),
  newWeeklySetsTotal: z.number(),
  oldAvgDurationMinutes: z.number(),
  newAvgDurationMinutes: z.number(),
  summary: z.array(z.string()),
})

export const previewAdjustmentBody = z.object({
  weeklyFrequency: z.number().int().min(1).max(7).optional(),
  sessionDurationMinutes: z.number().int().min(20).max(180).optional(),
  splitType: splitType.optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  /** Also persist the frequency/duration to the training profile when applied. */
  updateProfile: z.boolean().default(true),
})
export const adjustmentPreviewDto = z.object({
  previewId: z.uuid(),
  expiresAt: z.string(),
  proposal: planVersionDto.omit({ id: true, versionNumber: true, createdAt: true }).extend({
    sessions: z.array(planSessionDto.omit({ id: true }).extend({ exercises: z.array(planExerciseDto.omit({ id: true })) })),
  }),
  diff: planDiffDto,
})
export type AdjustmentPreviewDto = z.infer<typeof adjustmentPreviewDto>
export const applyPreviewBody = z.object({ previewId: z.uuid() })

/** Calendar view of one week: template weekday + per-week overrides + linked workouts. */
export const weekSessionDto = z.object({
  planSessionId: z.uuid(),
  name: z.string(),
  sequence: z.number().int(),
  focusMuscles: z.array(z.string()),
  estimatedDurationMinutes: z.number().int(),
  exerciseCount: z.number().int(),
  templateWeekday: z.number().int().min(0).max(6).nullable(),
  /** Date in this week (YYYY-MM-DD) after overrides, or null if skipped / unscheduled. */
  date: z.string().nullable(),
  status: z.enum(["planned", "skipped", "completed", "in_progress"]),
  workoutId: z.uuid().nullable(),
})
export const planWeekDto = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  planId: z.uuid().nullable(),
  sessions: z.array(weekSessionDto),
  /** The session the user should do next (first not-completed by date, today or later; else first open). */
  nextSessionId: z.uuid().nullable(),
})
export type PlanWeekDto = z.infer<typeof planWeekDto>
export type WeekSessionDto = z.infer<typeof weekSessionDto>

export const weekQuery = z.object({
  /** Any date inside the week (YYYY-MM-DD). Defaults to today (UTC). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeZone: z.string().max(64).optional(),
})
export const sessionOverrideBody = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(["move", "skip", "reset"]),
  /** Required for "move". */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
