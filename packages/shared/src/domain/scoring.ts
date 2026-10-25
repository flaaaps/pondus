import type { Equipment } from "./equipment"
import type { MuscleSlug } from "./muscles"
import type { ExerciseRef, ExperienceLevel, MovementPattern } from "./types"

export interface ScoringContext {
  targetMuscle: MuscleSlug
  focusMuscles: Set<MuscleSlug>
  preferred: Set<string>
  excluded: Set<string>
  /** Exercise ids the user already trains (existing plan). Rewarded for continuity. */
  continuity: Set<string>
  /** Recently used / favourite ids, small bonus. */
  familiar: Set<string>
  availableEquipment: Set<Equipment>
  experience: ExperienceLevel
  /** Movement patterns already present in the current session. */
  sessionPatterns: Set<MovementPattern>
  /** Exercise ids already in the current session. */
  sessionExerciseIds: Set<string>
  /** Exercise ids already used anywhere in the plan (for variety across sessions). */
  planExerciseIds: Set<string>
  /** Prefer compounds when true (first slots), isolations otherwise. */
  wantCompound: boolean
  /** Muscles the current session is responsible for; lower-body work on an upper day is penalised. */
  sessionMuscles?: Set<MuscleSlug>
  /** Exercise ids used in earlier sessions of the same kind (Oberkörper A → B): main lifts should vary. */
  siblingExerciseIds?: Set<string>
  /** How often each movement pattern already appears in the plan (all sessions so far + this one). */
  planPatternCounts?: Map<MovementPattern, number>
  /** Weekly cap per pattern (e.g. one pullover/shrug per week). */
  patternLimitsPerWeek?: Partial<Record<MovementPattern, number>>
  /** Plan-wide volume state per muscle: credit so far (plan + session), weekly target and cap. */
  muscleState?: (m: MuscleSlug) => { credit: number; target: number; cap: number }
  /** Slugs that are never a default pick (still allowed when preferred / continuity). */
  discouragedSlugs?: Set<string>
}

const LOWER_BODY_PATTERNS: MovementPattern[] = ["squat", "hinge", "lunge", "hip_extension", "hip_abduction", "hip_adduction", "knee_extension", "knee_flexion"]
const LOWER_BODY_MUSCLES: MuscleSlug[] = ["quads", "hamstrings", "glutes"]
/** Movement families: same family twice in a session is mostly redundant. */
const PATTERN_FAMILY: Partial<Record<MovementPattern, string>> = { hinge: "hip", hip_extension: "hip" }

export const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const

export function isEquipmentAvailable(ex: ExerciseRef, available: Set<Equipment>): boolean {
  return ex.equipment.every(e => available.has(e))
}

/**
 * Deterministic score for how well an exercise fits a slot. Higher is better;
 * `null` means "never pick this" (excluded, missing equipment, wrong muscle).
 */
export function scoreExercise(ex: ExerciseRef, ctx: ScoringContext): number | null {
  if (ctx.excluded.has(ex.id)) return null
  if (!isEquipmentAvailable(ex, ctx.availableEquipment)) return null
  if (ctx.sessionExerciseIds.has(ex.id)) return null
  if (ex.category === "cardio" || ex.category === "mobility" || ex.category === "warmup") return null

  const isPrimary = ex.primaryMuscles.includes(ctx.targetMuscle)
  const isSecondary = ex.secondaryMuscles.includes(ctx.targetMuscle)
  if (!isPrimary && !isSecondary) return null

  let score = isPrimary ? 10 : 4

  // Category fit for the slot.
  const isCompound = ex.category === "compound"
  if (ctx.wantCompound && isCompound) score += 4
  if (!ctx.wantCompound && !isCompound) score += 3
  if (ctx.wantCompound && !isCompound) score -= 2

  // User preferences influence but don't dominate.
  if (ctx.preferred.has(ex.id)) score += 3
  if (ctx.continuity.has(ex.id)) score += 3
  if (ctx.familiar.has(ex.id)) score += 1

  // Focus muscles: compounds that also hit a focus muscle as secondary earn a bit.
  for (const m of ex.secondaryMuscles) if (ctx.focusMuscles.has(m)) score += 0.5

  // Difficulty fit.
  const gap = DIFFICULTY_RANK[ex.difficulty] - DIFFICULTY_RANK[ctx.experience]
  if (gap > 0) score -= gap * 3
  if (gap < 0 && ctx.experience === "advanced" && isCompound) score -= 0.5

  // Redundancy: same movement pattern twice in a session is rarely useful.
  if (ctx.sessionPatterns.has(ex.movementPattern)) score -= 4
  else {
    const family = PATTERN_FAMILY[ex.movementPattern]
    if (family && [...ctx.sessionPatterns].some(p => PATTERN_FAMILY[p] === family)) score -= 2
  }
  const wanted = ctx.preferred.has(ex.id) || ctx.continuity.has(ex.id)
  // Plan-wide redundancy: limited patterns (pullovers, shrugs) at most N per week.
  const limit = ctx.patternLimitsPerWeek?.[ex.movementPattern]
  if (limit !== undefined && (ctx.planPatternCounts?.get(ex.movementPattern) ?? 0) >= limit && !wanted) score -= 8
  // Variation between sibling sessions (Oberkörper A/B): different main lifts, softer for isolation.
  if (ctx.siblingExerciseIds?.has(ex.id)) score -= isCompound ? 3 : 1.5
  if (ctx.discouragedSlugs?.has(ex.slug) && !wanted) score -= 6
  // Lower-body patterns on a session without lower-body muscles (rack pulls on upper day).
  if (ctx.sessionMuscles) {
    const lowerSession = LOWER_BODY_MUSCLES.some(m => ctx.sessionMuscles!.has(m))
    if (!lowerSession && LOWER_BODY_PATTERNS.includes(ex.movementPattern)) score -= 5
    for (const m of ex.primaryMuscles) if (!ctx.sessionMuscles.has(m)) score -= 3
  }
  // Volume budget: don't pile onto muscles that already reached their weekly target/cap.
  if (ctx.muscleState) {
    for (const m of ex.primaryMuscles) {
      if (m === ctx.targetMuscle) continue
      const st = ctx.muscleState(m)
      if (st.credit >= st.cap) score -= 6
      else if (st.credit >= st.target) score -= 3
    }
    for (const m of ex.secondaryMuscles) {
      if (m === ctx.targetMuscle || m === "forearms") continue
      const st = ctx.muscleState(m)
      if (st.credit >= st.cap) score -= 1
    }
  }
  // Variety across sessions, but keep it soft so continuity still wins when wanted.
  // A continuity exercise that is *not yet* in the plan beats repeating one that is.
  if (ctx.planExerciseIds.has(ex.id)) score -= ctx.continuity.has(ex.id) ? 1 : 1.5
  // Exercises spreading over several primary muscles are less targeted (e.g. thrusters).
  if (ex.primaryMuscles.length > 1) score -= (ex.primaryMuscles.length - 1) * 1.25

  // Free weights slightly preferred for compounds, machines slightly for beginners.
  if (isCompound && ex.loadType === "free_weight") score += 0.5
  if (ctx.experience === "beginner" && (ex.loadType === "machine" || ex.loadType === "cable")) score += 0.75
  if (ex.isUnilateral) score -= 0.5 // takes longer

  return score
}

/** Stable sort helper: higher score first, ties broken by slug for determinism. */
export function rankExercises(candidates: ExerciseRef[], ctx: ScoringContext): { exercise: ExerciseRef; score: number }[] {
  const scored: { exercise: ExerciseRef; score: number }[] = []
  for (const exercise of candidates) {
    const score = scoreExercise(exercise, ctx)
    if (score !== null) scored.push({ exercise, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.exercise.slug.localeCompare(b.exercise.slug))
}

/**
 * Rank substitutes for an exercise. Used by "swap exercise" and when a
 * preferred exercise cannot be performed with the available equipment.
 */
export function rankAlternatives(
  original: ExerciseRef,
  candidates: ExerciseRef[],
  opts: { availableEquipment?: Set<Equipment>; excluded?: Set<string>; experience?: ExperienceLevel; preferred?: Set<string> } = {},
): { exercise: ExerciseRef; score: number; reasons: string[] }[] {
  const out: { exercise: ExerciseRef; score: number; reasons: string[] }[] = []
  for (const ex of candidates) {
    if (ex.id === original.id) continue
    if (opts.excluded?.has(ex.id)) continue
    if (ex.category === "cardio" || ex.category === "mobility" || ex.category === "warmup") continue
    if (opts.availableEquipment && !isEquipmentAvailable(ex, opts.availableEquipment)) continue
    const reasons: string[] = []
    let score = 0
    const sharedPrimary = ex.primaryMuscles.filter(m => original.primaryMuscles.includes(m))
    if (sharedPrimary.length === 0) continue
    score += 6 * sharedPrimary.length
    reasons.push("Gleiche Hauptmuskulatur")
    const sharedSecondary = ex.secondaryMuscles.filter(m => original.secondaryMuscles.includes(m))
    score += sharedSecondary.length
    if (ex.movementPattern === original.movementPattern) {
      score += 4
      reasons.push("Gleiches Bewegungsmuster")
    }
    if (ex.category === original.category) score += 2
    if (ex.loadType === original.loadType) score += 1
    else reasons.push(ex.loadType === "machine" || ex.loadType === "cable" ? "Geführte Variante" : "Freie Variante")
    const gap = DIFFICULTY_RANK[ex.difficulty] - DIFFICULTY_RANK[opts.experience ?? original.difficulty]
    if (gap > 0) score -= 2 * gap
    if (opts.preferred?.has(ex.id)) {
      score += 2
      reasons.push("Von dir bevorzugt")
    }
    out.push({ exercise: ex, score, reasons })
  }
  return out.sort((a, b) => b.score - a.score || a.exercise.slug.localeCompare(b.exercise.slug))
}
