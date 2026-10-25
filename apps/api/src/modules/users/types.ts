import type { z } from "zod"
import type { exercisePreferencesDto, trainingProfileDto, updateTrainingProfileBody } from "@pondus/shared"
export type TrainingProfileDto = z.infer<typeof trainingProfileDto>
export type UpdateTrainingProfileBody = z.infer<typeof updateTrainingProfileBody>
export type ExercisePreferencesDto = z.infer<typeof exercisePreferencesDto>
