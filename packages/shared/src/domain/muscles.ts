/**
 * Muscle taxonomy. Slugs are stable identifiers used in the database seed,
 * the planner and the UI. Keep this list small and meaningful: these are the
 * groups a user plans around, not an anatomy atlas.
 */
export const MUSCLE_GROUPS = [
  { slug: "chest", nameDe: "Brust", nameEn: "Chest", region: "upper", displayOrder: 10 },
  { slug: "back", nameDe: "Rücken", nameEn: "Back", region: "upper", displayOrder: 20 },
  { slug: "shoulders", nameDe: "Schultern", nameEn: "Shoulders", region: "upper", displayOrder: 30 },
  { slug: "biceps", nameDe: "Bizeps", nameEn: "Biceps", region: "upper", displayOrder: 40 },
  { slug: "triceps", nameDe: "Trizeps", nameEn: "Triceps", region: "upper", displayOrder: 50 },
  { slug: "forearms", nameDe: "Unterarme", nameEn: "Forearms", region: "upper", displayOrder: 60 },
  { slug: "quads", nameDe: "Quadrizeps", nameEn: "Quads", region: "lower", displayOrder: 70 },
  { slug: "hamstrings", nameDe: "Beinbeuger", nameEn: "Hamstrings", region: "lower", displayOrder: 80 },
  { slug: "glutes", nameDe: "Gesäß", nameEn: "Glutes", region: "lower", displayOrder: 90 },
  { slug: "calves", nameDe: "Waden", nameEn: "Calves", region: "lower", displayOrder: 100 },
  { slug: "abs", nameDe: "Bauch", nameEn: "Abs", region: "core", displayOrder: 110 },
  { slug: "lower_back", nameDe: "Unterer Rücken", nameEn: "Lower back", region: "core", displayOrder: 120 },
] as const

export type MuscleSlug = (typeof MUSCLE_GROUPS)[number]["slug"]
export const MUSCLE_SLUGS = MUSCLE_GROUPS.map(m => m.slug) as MuscleSlug[]

export function isMuscleSlug(value: string): value is MuscleSlug {
  return (MUSCLE_SLUGS as string[]).includes(value)
}

export function muscleGroup(slug: MuscleSlug) {
  const found = MUSCLE_GROUPS.find(m => m.slug === slug)
  if (!found) throw new Error(`Unknown muscle group ${slug}`)
  return found
}

/**
 * Fatigue overlap between muscle groups, 0..1. Used by the planner to avoid
 * hammering the same tissue on consecutive days even when the primary
 * muscle group label differs (e.g. chest pressing fatigues triceps and front
 * delts). Values are deliberately coarse heuristics, not physiology claims.
 */
export const MUSCLE_OVERLAP: Partial<Record<MuscleSlug, Partial<Record<MuscleSlug, number>>>> = {
  chest: { shoulders: 0.5, triceps: 0.6 },
  shoulders: { chest: 0.3, triceps: 0.5 },
  triceps: { chest: 0.3, shoulders: 0.3 },
  back: { biceps: 0.6, forearms: 0.3, lower_back: 0.3 },
  biceps: { back: 0.2, forearms: 0.3 },
  forearms: { biceps: 0.2, back: 0.1 },
  quads: { glutes: 0.5, lower_back: 0.2 },
  hamstrings: { glutes: 0.6, lower_back: 0.4 },
  glutes: { quads: 0.3, hamstrings: 0.4, lower_back: 0.2 },
  lower_back: { hamstrings: 0.4, glutes: 0.3, back: 0.2 },
  calves: {},
  abs: { lower_back: 0.1 },
}

export function overlap(a: MuscleSlug, b: MuscleSlug): number {
  if (a === b) return 1
  return MUSCLE_OVERLAP[a]?.[b] ?? 0
}
