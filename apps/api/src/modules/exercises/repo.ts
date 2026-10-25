import { and, eq, inArray, isNull, or, sql } from "drizzle-orm"
import type { DbOrTx } from "../../db/client.js"
import { exerciseMuscles, exercises, muscleGroups, userExerciseFavorites, workoutExercises, workouts } from "../../db/schema.js"
import type { ExerciseDto, ExerciseRef, MuscleSlug } from "@pondus/shared"

export type ExerciseRow = typeof exercises.$inferSelect

export interface ExerciseWithMuscles extends ExerciseRow {
  primaryMuscles: MuscleSlug[]
  secondaryMuscles: MuscleSlug[]
}

/** Exercises visible to a user: system ones plus their own (non-deleted) custom ones. */
export const visibleTo = (userId: string) =>
  and(isNull(exercises.deletedAt), or(eq(exercises.isSystem, true), eq(exercises.ownerUserId, userId)))

export async function attachMuscles(db: DbOrTx, rows: ExerciseRow[]): Promise<ExerciseWithMuscles[]> {
  if (!rows.length) return []
  const links = await db
    .select({ exerciseId: exerciseMuscles.exerciseId, role: exerciseMuscles.role, slug: muscleGroups.slug })
    .from(exerciseMuscles)
    .innerJoin(muscleGroups, eq(muscleGroups.id, exerciseMuscles.muscleGroupId))
    .where(inArray(exerciseMuscles.exerciseId, rows.map(r => r.id)))
  const byId = new Map<string, { p: MuscleSlug[]; s: MuscleSlug[] }>()
  for (const l of links) {
    const e = byId.get(l.exerciseId) ?? { p: [], s: [] }
    ;(l.role === "primary" ? e.p : e.s).push(l.slug)
    byId.set(l.exerciseId, e)
  }
  return rows.map(r => ({ ...r, primaryMuscles: byId.get(r.id)?.p ?? [], secondaryMuscles: byId.get(r.id)?.s ?? [] }))
}

export function toRef(e: ExerciseWithMuscles): ExerciseRef {
  return {
    id: e.id,
    slug: e.slug,
    nameDe: e.nameDe,
    nameEn: e.nameEn,
    category: e.category,
    movementPattern: e.movementPattern,
    equipment: e.equipment,
    loadType: e.loadType,
    difficulty: e.difficulty,
    isUnilateral: e.isUnilateral,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    isSystem: e.isSystem,
    ...(e.setSeconds !== null ? { setSeconds: e.setSeconds } : {}),
  }
}

/** All exercises the planner may use for this user. */
export async function loadExerciseRefs(db: DbOrTx, userId: string): Promise<ExerciseRef[]> {
  const rows = await db.select().from(exercises).where(visibleTo(userId))
  return (await attachMuscles(db, rows)).map(toRef)
}

export async function loadExerciseMap(db: DbOrTx, userId: string): Promise<Map<string, ExerciseWithMuscles>> {
  const rows = await db.select().from(exercises).where(or(eq(exercises.isSystem, true), eq(exercises.ownerUserId, userId)))
  return new Map((await attachMuscles(db, rows)).map(e => [e.id, e]))
}

export async function favoriteIds(db: DbOrTx, userId: string): Promise<Set<string>> {
  const rows = await db.select({ id: userExerciseFavorites.exerciseId }).from(userExerciseFavorites).where(eq(userExerciseFavorites.userId, userId))
  return new Set(rows.map(r => r.id))
}

/** exerciseId → last completed workout time, for "recently used". */
export async function lastUsedMap(db: DbOrTx, userId: string): Promise<Map<string, Date>> {
  const rows = await db
    .select({ exerciseId: workoutExercises.exerciseId, last: sql<Date>`max(${workouts.completedAt})` })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed")))
    .groupBy(workoutExercises.exerciseId)
  const map = new Map<string, Date>()
  for (const r of rows) if (r.exerciseId && r.last) map.set(r.exerciseId, new Date(r.last))
  return map
}

export function toDto(e: ExerciseWithMuscles, favorites: Set<string>, lastUsed: Map<string, Date>): ExerciseDto {
  return {
    id: e.id,
    slug: e.slug,
    nameDe: e.nameDe,
    nameEn: e.nameEn,
    aliases: e.aliases,
    category: e.category,
    movementPattern: e.movementPattern,
    equipment: e.equipment,
    loadType: e.loadType,
    difficulty: e.difficulty,
    isUnilateral: e.isUnilateral,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    description: e.description,
    cues: e.cues,
    commonMistakes: e.commonMistakes,
    isSystem: e.isSystem,
    isFavorite: favorites.has(e.id),
    lastUsedAt: lastUsed.get(e.id)?.toISOString() ?? null,
    setSeconds: e.setSeconds,
  }
}
