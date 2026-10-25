import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import type { Db } from "../../db/client.js"
import { exerciseAlternatives, exerciseMuscles, exercises, muscleGroups, userExerciseFavorites, workoutExercises, workoutSets, workouts } from "../../db/schema.js"
import { badRequest, forbidden, notFound } from "../../shared/errors.js"
import { decodeCursor, encodeCursor } from "../../shared/pagination.js"
import { attachMuscles, favoriteIds, lastUsedMap, loadExerciseRefs, toDto, toRef, visibleTo, type ExerciseWithMuscles } from "./repo.js"
import { rankAlternatives, type ExerciseListQuery, type MuscleSlug } from "@pondus/shared"
import { loadTrainingProfile } from "../users/service.js"
import type { z } from "zod"
import type { createCustomExerciseBody, updateCustomExerciseBody, exerciseHistoryQuery } from "@pondus/shared"

type CreateBody = z.infer<typeof createCustomExerciseBody>
type UpdateBody = z.infer<typeof updateCustomExerciseBody>
type HistoryQuery = z.infer<typeof exerciseHistoryQuery>

function matchesText(e: ExerciseWithMuscles, q: string) {
  const needle = q.toLowerCase()
  return e.nameDe.toLowerCase().includes(needle) || e.nameEn.toLowerCase().includes(needle) || e.aliases.some(a => a.toLowerCase().includes(needle)) || e.slug.includes(needle)
}

export function createExercisesService(db: Db) {
  async function getVisible(userId: string, id: string): Promise<ExerciseWithMuscles> {
    const [row] = await db.select().from(exercises).where(and(eq(exercises.id, id), visibleTo(userId)))
    if (!row) throw notFound("Exercise")
    const [withMuscles] = await attachMuscles(db, [row])
    return withMuscles!
  }

  async function setMuscles(exerciseId: string, primary: string[], secondary: string[]) {
    const groups = await db.select().from(muscleGroups)
    const idBySlug = new Map(groups.map(g => [g.slug as string, g.id]))
    await db.delete(exerciseMuscles).where(eq(exerciseMuscles.exerciseId, exerciseId))
    const rows = [
      ...primary.map(m => ({ exerciseId, muscleGroupId: idBySlug.get(m)!, role: "primary" as const })),
      ...secondary.filter(m => !primary.includes(m)).map(m => ({ exerciseId, muscleGroupId: idBySlug.get(m)!, role: "secondary" as const })),
    ].filter(r => r.muscleGroupId)
    if (rows.length) await db.insert(exerciseMuscles).values(rows)
  }

  return {
    /** In-memory filtering over the visible library (a few hundred rows) keeps search snappy and simple. */
    async list(userId: string, query: ExerciseListQuery) {
      const rows = await attachMuscles(db, await db.select().from(exercises).where(visibleTo(userId)))
      const favorites = await favoriteIds(db, userId)
      const lastUsed = await lastUsedMap(db, userId)
      let items = rows
      if (query.q) items = items.filter(e => matchesText(e, query.q!))
      if (query.muscles?.length) items = items.filter(e => e.primaryMuscles.some(m => query.muscles!.includes(m)) || e.secondaryMuscles.some(m => query.muscles!.includes(m)))
      if (query.equipment?.length) items = items.filter(e => e.equipment.every(eq => query.equipment!.includes(eq)))
      if (query.category?.length) items = items.filter(e => query.category!.includes(e.category))
      if (query.difficulty?.length) items = items.filter(e => query.difficulty!.includes(e.difficulty))
      if (query.unilateral) items = items.filter(e => e.isUnilateral === (query.unilateral === "true"))
      if (query.favorites === "true") items = items.filter(e => favorites.has(e.id))
      if (query.custom === "true") items = items.filter(e => !e.isSystem)
      if (query.recent === "true") items = items.filter(e => lastUsed.has(e.id))
      if (query.sort === "recent") items.sort((a, b) => (lastUsed.get(b.id)?.getTime() ?? 0) - (lastUsed.get(a.id)?.getTime() ?? 0) || a.nameDe.localeCompare(b.nameDe, "de"))
      else {
        // Primary-muscle hits rank above secondary ones when filtering by muscle.
        const primaryHit = (e: ExerciseWithMuscles) => (query.muscles?.length && e.primaryMuscles.some(m => query.muscles!.includes(m)) ? 0 : 1)
        items.sort((a, b) => primaryHit(a) - primaryHit(b) || a.nameDe.localeCompare(b.nameDe, "de"))
      }
      const offset = decodeCursor<{ offset: number }>(query.cursor)?.offset ?? 0
      const page = items.slice(offset, offset + query.limit)
      return { items: page.map(e => toDto(e, favorites, lastUsed)), nextCursor: offset + query.limit < items.length ? encodeCursor({ offset: offset + query.limit }) : null, total: items.length }
    },

    async get(userId: string, id: string) {
      const e = await getVisible(userId, id)
      return toDto(e, await favoriteIds(db, userId), await lastUsedMap(db, userId))
    },

    async alternatives(userId: string, id: string) {
      const original = await getVisible(userId, id)
      const refs = await loadExerciseRefs(db, userId)
      const profile = await loadTrainingProfile(db, userId)
      const curated = await db.select({ id: exerciseAlternatives.alternativeExerciseId }).from(exerciseAlternatives).where(eq(exerciseAlternatives.exerciseId, id))
      const curatedIds = new Set(curated.map(c => c.id))
      const ranked = rankAlternatives(toRef(original), refs, {
        availableEquipment: new Set(profile.availableEquipment),
        excluded: new Set(profile.excludedExerciseIds),
        experience: profile.experienceLevel,
        preferred: new Set(profile.preferredExerciseIds),
      })
      // Curated alternatives float to the top, then the scored list.
      const boosted = ranked
        .map(r => (curatedIds.has(r.exercise.id) ? { ...r, score: r.score + 5, reasons: ["Empfohlene Alternative", ...r.reasons] } : r))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
      const rows = await attachMuscles(db, boosted.length ? await db.select().from(exercises).where(inArray(exercises.id, boosted.map(b => b.exercise.id))) : [])
      const byId = new Map(rows.map(r => [r.id, r]))
      const favorites = await favoriteIds(db, userId)
      const lastUsed = await lastUsedMap(db, userId)
      return boosted.filter(b => byId.has(b.exercise.id)).map(b => ({ exercise: toDto(byId.get(b.exercise.id)!, favorites, lastUsed), score: b.score, reasons: b.reasons }))
    },

    async setFavorite(userId: string, id: string, favorite: boolean) {
      await getVisible(userId, id)
      if (favorite) await db.insert(userExerciseFavorites).values({ userId, exerciseId: id }).onConflictDoNothing()
      else await db.delete(userExerciseFavorites).where(and(eq(userExerciseFavorites.userId, userId), eq(userExerciseFavorites.exerciseId, id)))
      return this.get(userId, id)
    },

    async createCustom(userId: string, body: CreateBody) {
      const slug = `custom-${randomUUID()}`
      const [row] = await db
        .insert(exercises)
        .values({
          slug,
          nameDe: body.nameDe,
          nameEn: body.nameEn ?? body.nameDe,
          category: body.category,
          movementPattern: body.movementPattern,
          equipment: body.equipment,
          loadType: body.loadType,
          difficulty: body.difficulty,
          isUnilateral: body.isUnilateral,
          description: body.description ?? null,
          isSystem: false,
          ownerUserId: userId,
        })
        .returning()
      if (!row) throw new Error("insert failed")
      await setMuscles(row.id, body.primaryMuscles, body.secondaryMuscles)
      return this.get(userId, row.id)
    },

    async updateCustom(userId: string, id: string, body: UpdateBody) {
      const existing = await getVisible(userId, id)
      if (existing.isSystem || existing.ownerUserId !== userId) throw forbidden("Only your own exercises can be edited")
      const { primaryMuscles, secondaryMuscles, ...rest } = body
      await db.update(exercises).set({ ...rest, updatedAt: new Date() }).where(eq(exercises.id, id))
      if (primaryMuscles || secondaryMuscles) await setMuscles(id, primaryMuscles ?? existing.primaryMuscles, secondaryMuscles ?? existing.secondaryMuscles)
      return this.get(userId, id)
    },

    /** Soft delete so historical workouts keep their reference and name snapshot. */
    async deleteCustom(userId: string, id: string) {
      const existing = await getVisible(userId, id)
      if (existing.isSystem || existing.ownerUserId !== userId) throw forbidden("Only your own exercises can be deleted")
      const usage = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sql`training_plan_exercises tpe join training_plan_sessions s on s.id = tpe.training_plan_session_id join training_plan_versions v on v.id = s.training_plan_version_id join training_plans p on p.id = v.training_plan_id`)
        .where(sql`tpe.exercise_id = ${id} and p.status = 'active' and v.version_number = p.current_version_number`)
      if ((usage[0]?.count ?? 0) > 0) throw badRequest("exercise_in_use", "This exercise is part of your active plan. Swap it out first.")
      await db.update(exercises).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(exercises.id, id))
    },

    /** Per-exercise workout history (completed workouts only). */
    async history(userId: string, id: string, query: HistoryQuery) {
      await getVisible(userId, id)
      const cursor = decodeCursor<{ before: string }>(query.cursor)
      const where = [eq(workouts.userId, userId), eq(workouts.status, "completed"), eq(workoutExercises.exerciseId, id)]
      if (query.from) where.push(sql`${workouts.completedAt} >= ${query.from}`)
      if (query.to) where.push(sql`${workouts.completedAt} <= ${query.to}`)
      if (cursor) where.push(sql`${workouts.completedAt} < ${cursor.before}`)
      const rows = await db
        .select({ workoutId: workouts.id, workoutName: workouts.name, completedAt: workouts.completedAt, workoutExerciseId: workoutExercises.id })
        .from(workoutExercises)
        .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
        .where(and(...where))
        .orderBy(desc(workouts.completedAt))
        .limit(query.limit + 1)
      const page = rows.slice(0, query.limit)
      const sets = page.length
        ? await db
            .select()
            .from(workoutSets)
            .where(inArray(workoutSets.workoutExerciseId, page.map(p => p.workoutExerciseId)))
            .orderBy(asc(workoutSets.setNumber))
        : []
      const items = page.map(p => ({
        workoutId: p.workoutId,
        workoutName: p.workoutName,
        completedAt: p.completedAt!.toISOString(),
        sets: sets
          .filter(s => s.workoutExerciseId === p.workoutExerciseId)
          .map(s => ({ setNumber: s.setNumber, setType: s.setType, weightGrams: s.weightGrams, reps: s.reps, rir: s.rir, rpe: s.rpe === null ? null : Number(s.rpe), completed: s.completed })),
      }))
      const last = page[page.length - 1]
      return { items, nextCursor: rows.length > query.limit && last ? encodeCursor({ before: last.completedAt!.toISOString() }) : null }
    },

    muscleGroups: async () => db.select().from(muscleGroups).orderBy(asc(muscleGroups.displayOrder)),
  }
}

export type MuscleFilter = MuscleSlug[]
