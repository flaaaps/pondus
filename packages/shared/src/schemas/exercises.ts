import { z } from "zod"
import { EQUIPMENT } from "../domain/equipment"
import { MUSCLE_SLUGS } from "../domain/muscles"
import { DIFFICULTIES, EXERCISE_CATEGORIES, LOAD_TYPES, MOVEMENT_PATTERNS } from "../domain/types"
import { isoDateTime, paginationQuery } from "./common"

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess(v => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(item)).optional()

export const exerciseDto = z.object({
  id: z.uuid(),
  slug: z.string(),
  nameDe: z.string(),
  nameEn: z.string(),
  aliases: z.array(z.string()),
  category: z.enum(EXERCISE_CATEGORIES),
  movementPattern: z.enum(MOVEMENT_PATTERNS),
  equipment: z.array(z.enum(EQUIPMENT)),
  loadType: z.enum(LOAD_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  isUnilateral: z.boolean(),
  primaryMuscles: z.array(z.enum(MUSCLE_SLUGS as [string, ...string[]])),
  secondaryMuscles: z.array(z.enum(MUSCLE_SLUGS as [string, ...string[]])),
  description: z.string().nullable(),
  cues: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  isSystem: z.boolean(),
  isFavorite: z.boolean(),
  lastUsedAt: z.string().nullable(),
  setSeconds: z.number().int().nullable(),
  /** The user's lasting note on this exercise (seat setting, grip, machine …), null = none. */
  note: z.string().nullable(),
  /** Last edit of `note` (also set after deleting it), null = never written. */
  noteUpdatedAt: z.string().nullable(),
})
export type ExerciseDto = z.infer<typeof exerciseDto>

export const exerciseListQuery = paginationQuery.extend({
  q: z.string().trim().max(80).optional(),
  muscles: csv(z.enum(MUSCLE_SLUGS as [string, ...string[]])),
  equipment: csv(z.enum(EQUIPMENT)),
  category: csv(z.enum(EXERCISE_CATEGORIES)),
  difficulty: csv(z.enum(DIFFICULTIES)),
  unilateral: z.enum(["true", "false"]).optional(),
  favorites: z.enum(["true", "false"]).optional(),
  custom: z.enum(["true", "false"]).optional(),
  recent: z.enum(["true", "false"]).optional(),
  sort: z.enum(["name", "recent"]).default("name"),
})
export type ExerciseListQuery = z.infer<typeof exerciseListQuery>

export const createCustomExerciseBody = z.object({
  nameDe: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80).optional(),
  category: z.enum(EXERCISE_CATEGORIES),
  movementPattern: z.enum(MOVEMENT_PATTERNS),
  equipment: z.array(z.enum(EQUIPMENT)).min(1).max(4),
  loadType: z.enum(LOAD_TYPES),
  difficulty: z.enum(DIFFICULTIES).default("beginner"),
  isUnilateral: z.boolean().default(false),
  primaryMuscles: z.array(z.enum(MUSCLE_SLUGS as [string, ...string[]])).min(1).max(3),
  secondaryMuscles: z.array(z.enum(MUSCLE_SLUGS as [string, ...string[]])).max(4).default([]),
  description: z.string().trim().max(500).optional(),
})
export const updateCustomExerciseBody = createCustomExerciseBody.partial()

export const alternativeDto = z.object({
  exercise: exerciseDto,
  score: z.number(),
  reasons: z.array(z.string()),
})

export const exerciseHistoryQuery = paginationQuery.extend({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
})

export const EXERCISE_NOTE_MAX_LENGTH = 500

/** Trims a note; blank means "no note" (null). */
export function normalizeExerciseNote(note: string | null | undefined): string | null {
  const t = note?.trim() ?? ""
  return t ? t : null
}

/**
 * Sets (string) or deletes (null / blank) the user's note on an exercise. `updatedAt` is the
 * client edit time; the server keeps the newest write (last writer wins), so offline replays
 * never overwrite a newer note from another device.
 */
export const setExerciseNoteBody = z.object({
  note: z.string().max(EXERCISE_NOTE_MAX_LENGTH).nullable(),
  updatedAt: isoDateTime.optional(),
})
export type SetExerciseNoteBody = z.infer<typeof setExerciseNoteBody>
