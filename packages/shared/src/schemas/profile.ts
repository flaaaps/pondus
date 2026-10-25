import { z } from "zod"
import { EQUIPMENT, TRAINING_ENVIRONMENTS } from "../domain/equipment"
import { MUSCLE_SLUGS } from "../domain/muscles"
import { EXPERIENCE_LEVELS, GOALS, PREFERENCE_TYPES } from "../domain/types"

export const goal = z.enum(GOALS)
export const experienceLevel = z.enum(EXPERIENCE_LEVELS)
export const environment = z.enum(TRAINING_ENVIRONMENTS)
export const equipment = z.enum(EQUIPMENT)
export const muscleSlug = z.enum(MUSCLE_SLUGS as [string, ...string[]])
export const preferenceType = z.enum(PREFERENCE_TYPES)

export const musclePriority = z.object({ muscle: muscleSlug, priority: z.number().int().min(1).max(10) })

export const trainingProfileDto = z.object({
  primaryGoal: goal,
  secondaryGoals: z.array(goal).max(4),
  experienceLevel,
  sessionDurationMinutes: z.number().int().min(20).max(180),
  weeklyFrequency: z.number().int().min(1).max(7),
  environment,
  availableEquipment: z.array(equipment),
  preferredWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
  musclePriorities: z.array(musclePriority).max(10),
  updatedAt: z.string().nullable(),
})
export type TrainingProfileDto = z.infer<typeof trainingProfileDto>

export const updateTrainingProfileBody = trainingProfileDto.omit({ updatedAt: true }).partial()
export type UpdateTrainingProfileBody = z.infer<typeof updateTrainingProfileBody>

export const updateUserBody = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  weightUnit: z.enum(["kg", "lb"]).optional(),
  locale: z.enum(["de", "en"]).optional(),
  onboardingCompleted: z.boolean().optional(),
})

export const exercisePreferencesDto = z.object({
  preferred: z.array(z.uuid()),
  excluded: z.array(z.uuid()),
})
export type ExercisePreferencesDto = z.infer<typeof exercisePreferencesDto>
export const updateExercisePreferencesBody = z.object({
  /** Full replacement of both lists; an exercise cannot be in both. */
  preferred: z.array(z.uuid()).max(200),
  excluded: z.array(z.uuid()).max(200),
})
export const updateMusclePrioritiesBody = z.object({ priorities: z.array(musclePriority).max(10) })
