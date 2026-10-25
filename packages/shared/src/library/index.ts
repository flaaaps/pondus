import { CHEST, BACK } from "./chest-back"
import { SHOULDERS, BICEPS, TRICEPS } from "./shoulders-arms"
import { LEGS } from "./legs"
import { CORE, LOWER_BACK, FOREARMS, FULL_BODY, WARMUP, CARDIO, MOBILITY } from "./core-other"
import type { ExerciseSeed } from "./types"
import type { ExerciseRef } from "../domain/types"

export type { ExerciseSeed } from "./types"

export const EXERCISE_LIBRARY: ExerciseSeed[] = [
  ...CHEST,
  ...BACK,
  ...SHOULDERS,
  ...BICEPS,
  ...TRICEPS,
  ...LEGS,
  ...CORE,
  ...LOWER_BACK,
  ...FOREARMS,
  ...FULL_BODY,
  ...WARMUP,
  ...CARDIO,
  ...MOBILITY,
]

/** Map seeds to planner refs using the slug as id (tests / offline use). */
export function libraryAsRefs(seeds: ExerciseSeed[] = EXERCISE_LIBRARY): ExerciseRef[] {
  return seeds.map(s => ({
    id: s.slug,
    slug: s.slug,
    nameDe: s.nameDe,
    nameEn: s.nameEn,
    category: s.category,
    movementPattern: s.movementPattern,
    equipment: s.equipment,
    loadType: s.loadType,
    difficulty: s.difficulty,
    isUnilateral: s.isUnilateral,
    primaryMuscles: s.primaryMuscles,
    secondaryMuscles: s.secondaryMuscles,
    isSystem: true,
    ...(s.setSeconds !== undefined ? { setSeconds: s.setSeconds } : {}),
  }))
}
