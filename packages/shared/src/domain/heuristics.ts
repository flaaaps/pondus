import type { ExerciseCategory, ExperienceLevel, Goal } from "./types"
import type { MuscleSlug } from "./muscles"

/**
 * All planning numbers live here so they can be tuned (or overridden per
 * test) without touching the algorithm. They are deliberately conservative
 * heuristics: the app never claims to know the exact optimal dose.
 */
export interface PlanningHeuristics {
  /** Direct working sets per muscle per week by experience level. */
  weeklySetsPerMuscle: Record<ExperienceLevel, { min: number; target: number; max: number }>
  /** Multipliers applied to weekly set targets per focus priority rank (1 = top). */
  priorityMultipliers: Record<number, number>
  /** Multiplier for muscles that are *not* a focus when the user has focus muscles. */
  nonFocusMultiplier: number
  /** How much a secondary-muscle set counts toward that muscle's weekly target. */
  secondarySetCredit: number
  /** Rep range, rest and RIR per goal and category. */
  prescriptions: Record<
    Goal,
    Record<"compound" | "isolation" | "core", { repsMin: number; repsMax: number; restSeconds: number; rir: number }>
  >
  /** Sets per exercise bounds. */
  setsPerExercise: { min: number; max: number }
  /** Maximum different exercises per session before the plan is considered bloated. */
  maxExercisesPerSession: Record<ExperienceLevel, number>
  /** Duration model. */
  duration: {
    setSecondsDefault: Record<ExerciseCategory, number>
    warmupSetSeconds: number
    exerciseTransitionSeconds: number
    sessionOverheadSeconds: number
  }
  /** Warm-up sets prescribed for the first compound(s) of a session. */
  warmupSetsForFirstCompounds: number
  /** Relative muscle "size" weights used to order compounds first and allocate sets. */
  muscleWeight: Record<MuscleSlug, number>
}

export const DEFAULT_HEURISTICS: PlanningHeuristics = {
  weeklySetsPerMuscle: {
    beginner: { min: 6, target: 8, max: 12 },
    intermediate: { min: 8, target: 12, max: 16 },
    advanced: { min: 10, target: 14, max: 20 },
  },
  priorityMultipliers: { 1: 1.5, 2: 1.35, 3: 1.2, 4: 1.1 },
  nonFocusMultiplier: 0.85,
  secondarySetCredit: 0.5,
  prescriptions: {
    hypertrophy: {
      compound: { repsMin: 6, repsMax: 10, restSeconds: 150, rir: 2 },
      isolation: { repsMin: 10, repsMax: 15, restSeconds: 90, rir: 1 },
      core: { repsMin: 10, repsMax: 20, restSeconds: 60, rir: 2 },
    },
    strength: {
      compound: { repsMin: 3, repsMax: 6, restSeconds: 210, rir: 2 },
      isolation: { repsMin: 8, repsMax: 12, restSeconds: 120, rir: 2 },
      core: { repsMin: 8, repsMax: 15, restSeconds: 90, rir: 2 },
    },
    general_fitness: {
      compound: { repsMin: 8, repsMax: 12, restSeconds: 120, rir: 2 },
      isolation: { repsMin: 10, repsMax: 15, restSeconds: 75, rir: 2 },
      core: { repsMin: 10, repsMax: 20, restSeconds: 60, rir: 2 },
    },
    return_to_training: {
      compound: { repsMin: 8, repsMax: 12, restSeconds: 120, rir: 3 },
      isolation: { repsMin: 12, repsMax: 15, restSeconds: 75, rir: 3 },
      core: { repsMin: 10, repsMax: 20, restSeconds: 60, rir: 3 },
    },
    muscle_focus: {
      compound: { repsMin: 6, repsMax: 10, restSeconds: 150, rir: 2 },
      isolation: { repsMin: 10, repsMax: 15, restSeconds: 90, rir: 1 },
      core: { repsMin: 10, repsMax: 20, restSeconds: 60, rir: 2 },
    },
  },
  setsPerExercise: { min: 2, max: 4 },
  maxExercisesPerSession: { beginner: 6, intermediate: 7, advanced: 8 },
  duration: {
    setSecondsDefault: { compound: 45, isolation: 35, core: 40, cardio: 600, mobility: 60, warmup: 45 },
    warmupSetSeconds: 50,
    exerciseTransitionSeconds: 75,
    sessionOverheadSeconds: 300,
  },
  warmupSetsForFirstCompounds: 2,
  muscleWeight: {
    quads: 1.0,
    glutes: 0.9,
    back: 1.0,
    chest: 0.9,
    hamstrings: 0.8,
    shoulders: 0.7,
    triceps: 0.5,
    biceps: 0.5,
    calves: 0.4,
    abs: 0.4,
    lower_back: 0.4,
    forearms: 0.3,
  },
}

export function prescriptionCategory(category: ExerciseCategory): "compound" | "isolation" | "core" {
  if (category === "compound") return "compound"
  if (category === "core") return "core"
  return "isolation"
}
