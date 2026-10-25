import type { Equipment, TrainingEnvironment } from "./equipment"
import type { MuscleSlug } from "./muscles"

export const EXERCISE_CATEGORIES = [
  "compound",
  "isolation",
  "core",
  "cardio",
  "mobility",
  "warmup",
] as const
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number]

export const MOVEMENT_PATTERNS = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "elbow_flexion",
  "elbow_extension",
  "shoulder_abduction",
  "shoulder_flexion",
  "shoulder_horizontal_abduction",
  "shoulder_horizontal_adduction",
  "hip_abduction",
  "hip_adduction",
  "hip_extension",
  "knee_extension",
  "knee_flexion",
  "plantar_flexion",
  "trunk_flexion",
  "anti_rotation",
  "anti_extension",
  "lateral_flexion",
  "spinal_extension",
  "carry",
  "grip",
  "wrist_flexion",
  "wrist_extension",
  "locomotion",
  "mobility",
] as const
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number]

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/**
 * How an exercise is loaded. `assisted` means the logged weight is *assistance*
 * (counterweight / band) that is subtracted from body weight: less is better.
 * Records, e1RM and tonnage treat it accordingly (see records.ts / volume.ts).
 */
export const LOAD_TYPES = ["machine", "cable", "free_weight", "bodyweight", "assisted"] as const
export type LoadType = (typeof LOAD_TYPES)[number]

/** Domain view of an exercise as the planner needs it (DB rows map onto this). */
export interface ExerciseRef {
  id: string
  slug: string
  nameDe: string
  nameEn: string
  category: ExerciseCategory
  movementPattern: MovementPattern
  equipment: Equipment[]
  loadType: LoadType
  difficulty: Difficulty
  isUnilateral: boolean
  primaryMuscles: MuscleSlug[]
  secondaryMuscles: MuscleSlug[]
  isSystem: boolean
  /** Seconds a typical working set takes including setup; affects duration estimate. */
  setSeconds?: number
}

export const GOALS = ["hypertrophy", "strength", "general_fitness", "return_to_training", "muscle_focus"] as const
export type Goal = (typeof GOALS)[number]

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]

export const SPLIT_TYPES = ["full_body", "upper_lower", "push_pull_legs", "custom"] as const
export type SplitType = (typeof SPLIT_TYPES)[number]

export const PREFERENCE_TYPES = ["preferred", "excluded"] as const
export type PreferenceType = (typeof PREFERENCE_TYPES)[number]

export interface TrainingProfile {
  primaryGoal: Goal
  secondaryGoals: Goal[]
  experienceLevel: ExperienceLevel
  sessionDurationMinutes: number
  weeklyFrequency: number
  environment: TrainingEnvironment
  availableEquipment: Equipment[]
  /** Priority 1 = highest. Missing muscles are neutral. */
  musclePriorities: { muscle: MuscleSlug; priority: number }[]
  preferredExerciseIds: string[]
  excludedExerciseIds: string[]
  /** 0 = Sunday … 6 = Saturday, ISO weekday numbering below is NOT used; JS getDay() numbering is. */
  preferredWeekdays?: number[]
}

export const SET_TYPES = ["warmup", "working", "drop", "superset", "failure", "backoff"] as const
export type SetType = (typeof SET_TYPES)[number]

export interface PlanExerciseDraft {
  exerciseId: string
  sequence: number
  targetSets: number
  targetRepsMin: number
  targetRepsMax: number
  restSeconds: number
  targetRir: number | null
  warmupSets: number
  notes: string | null
}

export interface PlanSessionDraft {
  name: string
  sequence: number
  /** Assigned weekday (0 = Sunday … 6 = Saturday) or null if the user trains "whenever". */
  weekday: number | null
  focusMuscles: MuscleSlug[]
  estimatedDurationMinutes: number
  exercises: PlanExerciseDraft[]
}

export interface PlanRationaleItem {
  key: string
  title: string
  body: string
}

export interface PlanDraft {
  name: string
  splitType: SplitType
  weeklyFrequency: number
  sessions: PlanSessionDraft[]
  /** Working sets per week per muscle (direct + fractional indirect). */
  weeklySets: Record<MuscleSlug, number>
  rationale: PlanRationaleItem[]
}
