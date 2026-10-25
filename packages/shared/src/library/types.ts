import type { Equipment } from "../domain/equipment"
import type { MuscleSlug } from "../domain/muscles"
import type { Difficulty, ExerciseCategory, LoadType, MovementPattern } from "../domain/types"

/** Seed definition of a system exercise. Slugs are stable public identifiers. */
export interface ExerciseSeed {
  slug: string
  nameDe: string
  nameEn: string
  aliases: string[]
  category: ExerciseCategory
  movementPattern: MovementPattern
  equipment: Equipment[]
  loadType: LoadType
  difficulty: Difficulty
  isUnilateral: boolean
  primaryMuscles: MuscleSlug[]
  secondaryMuscles: MuscleSlug[]
  description: string
  cues: string[]
  commonMistakes: string[]
  /** Curated alternative slugs (in addition to computed alternatives). */
  alternatives: string[]
  /** Typical seconds per working set incl. setup; falls back to category default. */
  setSeconds?: number
}

interface Opts {
  cat: ExerciseCategory
  mp: MovementPattern
  eq: Equipment[]
  load: LoadType
  diff?: Difficulty
  uni?: boolean
  p: MuscleSlug[]
  s?: MuscleSlug[]
  desc: string
  cues?: string[]
  mistakes?: string[]
  aliases?: string[]
  alt?: string[]
  setSeconds?: number
}

export function ex(slug: string, nameDe: string, nameEn: string, o: Opts): ExerciseSeed {
  return {
    slug,
    nameDe,
    nameEn,
    aliases: o.aliases ?? [],
    category: o.cat,
    movementPattern: o.mp,
    equipment: o.eq,
    loadType: o.load,
    difficulty: o.diff ?? "beginner",
    isUnilateral: o.uni ?? false,
    primaryMuscles: o.p,
    secondaryMuscles: o.s ?? [],
    description: o.desc,
    cues: o.cues ?? [],
    commonMistakes: o.mistakes ?? [],
    alternatives: o.alt ?? [],
    ...(o.setSeconds !== undefined ? { setSeconds: o.setSeconds } : {}),
  }
}
