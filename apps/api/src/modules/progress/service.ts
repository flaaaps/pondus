import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm"
import type { Db } from "../../db/client.js"
import { exerciseBests, exerciseMuscles, exercises, muscleGroups, personalRecords, trainingPlans, trainingPlanVersions, workoutExercises, workoutSets, workouts } from "../../db/schema.js"
import { notFound } from "../../shared/errors.js"
import { addDaysISO, resolveTimeZone, weekStartISO } from "../../shared/time.js"
import { decodeCursor, encodeCursor } from "../../shared/pagination.js"
import { SET_VOLUME_CREDIT, estimateSetOneRepMaxGrams, incrementForExercise, recommendProgression, tonnageGrams, type ExerciseProgressDto, type LoadType, type PerformanceSnapshot, type ProgressOverviewDto } from "@pondus/shared"

/** No body weight is stored yet, so assisted sets have no effective load (e1RM/tonnage null/0). */
const BODYWEIGHT_GRAMS: number | null = null

const RANGE_DAYS: Record<string, number | null> = { "4w": 28, "8w": 56, "12w": 84, "6m": 183, "1y": 365, all: null }

export function createProgressService(db: Db) {
  const sinceFor = (range: string) => {
    const days = RANGE_DAYS[range] ?? 84
    return days === null ? null : new Date(Date.now() - days * 86400 * 1000)
  }

  return {
    async overview(userId: string, range: string, timeZoneInput?: string): Promise<ProgressOverviewDto> {
      const timeZone = resolveTimeZone(timeZoneInput)
      const since = sinceFor(range)
      const rows = await db
        .select({
          id: workouts.id,
          name: workouts.name,
          completedAt: workouts.completedAt,
          durationSeconds: workouts.durationSeconds,
          workingSets: sql<number>`count(*) filter (where ${workoutSets.completed} and ${workoutSets.setType} <> 'warmup')::int`,
          // Assisted sets log assistance, not load → excluded from tonnage.
          tonnage: sql<number>`coalesce(sum(case when ${workoutSets.completed} and ${workoutSets.setType} <> 'warmup' and coalesce(${exercises.loadType}::text, '') <> 'assisted' then coalesce(${workoutSets.weightGrams},0) * coalesce(${workoutSets.reps},0) else 0 end), 0)::bigint`,
        })
        .from(workouts)
        .leftJoin(workoutExercises, and(eq(workoutExercises.workoutId, workouts.id), eq(workoutExercises.skipped, false)))
        .leftJoin(workoutSets, eq(workoutSets.workoutExerciseId, workoutExercises.id))
        .leftJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
        .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), since ? gte(workouts.completedAt, since) : undefined))
        .groupBy(workouts.id)
        .orderBy(desc(workouts.completedAt))

      const thisWeek = weekStartISO(new Date(), timeZone)
      const fourWeeksAgo = addDaysISO(thisWeek, -21)
      const weekOf = (d: Date) => weekStartISO(d, timeZone)
      const weekly = new Map<string, { tonnageGrams: number; workingSets: number; workouts: number; durationSeconds: number }>()
      for (const r of rows) {
        const key = weekOf(r.completedAt!)
        const w = weekly.get(key) ?? { tonnageGrams: 0, workingSets: 0, workouts: 0, durationSeconds: 0 }
        w.tonnageGrams += Number(r.tonnage)
        w.workingSets += r.workingSets
        w.workouts += 1
        w.durationSeconds += r.durationSeconds ?? 0
        weekly.set(key, w)
      }
      // Fill empty weeks inside the range so charts show gaps honestly.
      const weeks: ProgressOverviewDto["weeklyVolume"] = []
      const firstWeek = since ? weekStartISO(since, timeZone) : rows.length ? weekOf(rows[rows.length - 1]!.completedAt!) : thisWeek
      for (let w = firstWeek; w <= thisWeek; w = addDaysISO(w, 7)) weeks.push({ weekStart: w, ...(weekly.get(w) ?? { tonnageGrams: 0, workingSets: 0, workouts: 0, durationSeconds: 0 }) })

      // Streak: consecutive weeks (ending this or last week) with ≥ 1 workout.
      let streak = 0
      let cursor = weekly.has(thisWeek) ? thisWeek : addDaysISO(thisWeek, -7)
      while (weekly.has(cursor)) {
        streak += 1
        cursor = addDaysISO(cursor, -7)
      }

      const [plan] = await db.select({ v: trainingPlanVersions }).from(trainingPlans).innerJoin(trainingPlanVersions, and(eq(trainingPlanVersions.trainingPlanId, trainingPlans.id), eq(trainingPlanVersions.versionNumber, trainingPlans.currentVersionNumber))).where(and(eq(trainingPlans.userId, userId), eq(trainingPlans.status, "active")))

      // Weekly sets per muscle use SET_VOLUME_CREDIT (shared): warm-ups 0, drop sets ½, everything else 1.
      const setVolumeCreditSql = sql<number>`coalesce(sum(case when not ${workoutSets.completed} then 0 when ${workoutSets.setType} = 'warmup' then ${sql.raw(String(SET_VOLUME_CREDIT.warmup))} when ${workoutSets.setType} = 'drop' then ${sql.raw(String(SET_VOLUME_CREDIT.drop))} else 1 end), 0)::float`
      const muscleRows = await db
        .select({ slug: muscleGroups.slug, role: exerciseMuscles.role, sets: setVolumeCreditSql })
        .from(workoutSets)
        .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
        .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
        .innerJoin(exerciseMuscles, eq(exerciseMuscles.exerciseId, workoutExercises.exerciseId))
        .innerJoin(muscleGroups, eq(muscleGroups.id, exerciseMuscles.muscleGroupId))
        .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), eq(workoutExercises.skipped, false), since ? gte(workouts.completedAt, since) : undefined))
        .groupBy(muscleGroups.slug, exerciseMuscles.role)
      const dist = new Map<string, number>()
      for (const m of muscleRows) dist.set(m.slug, (dist.get(m.slug) ?? 0) + m.sets * (m.role === "primary" ? 1 : 0.5))

      // This week's sets per muscle vs. the plan's weekly target (same weighting as the planner: secondary = 0.5).
      const weekMuscleRows = await db
        .select({ slug: muscleGroups.slug, role: exerciseMuscles.role, sets: setVolumeCreditSql })
        .from(workoutSets)
        .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
        .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
        .innerJoin(exerciseMuscles, eq(exerciseMuscles.exerciseId, workoutExercises.exerciseId))
        .innerJoin(muscleGroups, eq(muscleGroups.id, exerciseMuscles.muscleGroupId))
        .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), eq(workoutExercises.skipped, false), sql`${workouts.completedAt} >= (${thisWeek}::date::timestamp at time zone ${timeZone})`))
        .groupBy(muscleGroups.slug, exerciseMuscles.role)
      const weekActual = new Map<string, number>()
      for (const m of weekMuscleRows) weekActual.set(m.slug, (weekActual.get(m.slug) ?? 0) + m.sets * (m.role === "primary" ? 1 : 0.5))
      const groups = await db.select({ slug: muscleGroups.slug, nameDe: muscleGroups.nameDe, displayOrder: muscleGroups.displayOrder }).from(muscleGroups).orderBy(asc(muscleGroups.displayOrder))
      const targets = (plan?.v.weeklySets ?? {}) as Record<string, number>
      const round1 = (n: number) => Math.round(n * 10) / 10
      const muscleWeeklySets = groups
        .map(g => ({ muscle: g.slug as string, label: g.nameDe, actualSets: round1(weekActual.get(g.slug) ?? 0), targetSets: round1(targets[g.slug] ?? 0) }))
        .filter(m => m.actualSets > 0 || m.targetSets > 0)

      const records = await db.select().from(personalRecords).where(eq(personalRecords.userId, userId)).orderBy(desc(personalRecords.achievedAt)).limit(8)
      const last = rows[0]
      const totalRows = await db.select({ total: sql<number>`count(*)::int` }).from(workouts).where(and(eq(workouts.userId, userId), eq(workouts.status, "completed")))
      const total = totalRows[0]?.total ?? 0

      return {
        workoutsThisWeek: weekly.get(thisWeek)?.workouts ?? 0,
        plannedThisWeek: plan?.v.weeklyFrequency ?? 0,
        workoutsLast4Weeks: rows.filter(r => weekOf(r.completedAt!) >= fourWeeksAgo).length,
        currentStreakWeeks: streak,
        totalWorkouts: total,
        lastWorkout: last ? { id: last.id, name: last.name, completedAt: last.completedAt!.toISOString(), durationSeconds: last.durationSeconds, tonnageGrams: Number(last.tonnage), workingSets: last.workingSets } : null,
        recentRecords: records.map(r => ({ exerciseId: r.exerciseId, exerciseName: r.exerciseNameSnapshot, type: r.type, valueGrams: r.valueGrams === null ? null : Number(r.valueGrams), reps: r.reps, weightGrams: r.weightGrams, achievedAt: r.achievedAt.toISOString(), isEstimate: r.isEstimate })),
        weeklyVolume: weeks,
        muscleWeeklySets,
        muscleDistribution: [...dist.entries()].map(([muscle, workingSets]) => ({ muscle, workingSets: Math.round(workingSets * 10) / 10 })).sort((a, b) => b.workingSets - a.workingSets),
      }
    },

    async exercise(userId: string, exerciseId: string, range: string): Promise<ExerciseProgressDto> {
      const [ex] = await db.select().from(exercises).where(eq(exercises.id, exerciseId))
      if (!ex || (!ex.isSystem && ex.ownerUserId !== userId)) throw notFound("Exercise")
      const since = sinceFor(range)
      const loadType = ex.loadType as LoadType
      const assisted = loadType === "assisted"
      const perf = await db
        .select({ workoutId: workouts.id, completedAt: workouts.completedAt, workoutExerciseId: workoutExercises.id })
        .from(workoutExercises)
        .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
        .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), eq(workoutExercises.exerciseId, exerciseId), eq(workoutExercises.skipped, false), since ? gte(workouts.completedAt, since) : undefined))
        .orderBy(asc(workouts.completedAt))
      const sets = perf.length ? await db.select().from(workoutSets).where(and(inArray(workoutSets.workoutExerciseId, perf.map(p => p.workoutExerciseId)), eq(workoutSets.completed, true), ne(workoutSets.setType, "warmup"))) : []
      const points = perf
        .map(p => {
          const s = sets.filter(x => x.workoutExerciseId === p.workoutExerciseId)
          if (!s.length) return null
          // Top set: heaviest load; for assisted exercises the least assistance.
          const top = s.reduce((a, b) => (assisted ? (b.weightGrams ?? 0) < (a.weightGrams ?? 0) : (b.weightGrams ?? 0) > (a.weightGrams ?? 0)) ? b : a)
          return {
            workoutId: p.workoutId,
            performedAt: p.completedAt!.toISOString(),
            topWeightGrams: top.weightGrams ?? 0,
            topReps: top.reps ?? 0,
            estimated1rmGrams: estimateSetOneRepMaxGrams(top.weightGrams, top.reps, loadType, BODYWEIGHT_GRAMS),
            tonnageGrams: tonnageGrams(s.map(x => ({ setType: x.setType, weightGrams: x.weightGrams, reps: x.reps, completed: x.completed, loadType })), { bodyweightGrams: BODYWEIGHT_GRAMS }),
            workingSets: s.length,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
      const [best] = await db.select().from(exerciseBests).where(and(eq(exerciseBests.userId, userId), eq(exerciseBests.exerciseId, exerciseId)))

      // Recommendation uses the full recent history (not just the chart range) and the current plan target if any.
      const recent = await db
        .select({ completedAt: workouts.completedAt, workoutExerciseId: workoutExercises.id, repsMin: workoutExercises.targetRepsMin, repsMax: workoutExercises.targetRepsMax, rir: workoutExercises.targetRir, targetSets: workoutExercises.targetSets })
        .from(workoutExercises)
        .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
        .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), eq(workoutExercises.exerciseId, exerciseId), eq(workoutExercises.skipped, false)))
        .orderBy(desc(workouts.completedAt))
        .limit(3)
      let recommendation: ExerciseProgressDto["recommendation"] = null
      if (recent.length) {
        const recentSets = await db.select().from(workoutSets).where(and(inArray(workoutSets.workoutExerciseId, recent.map(r => r.workoutExerciseId)), eq(workoutSets.completed, true)))
        const history: PerformanceSnapshot[] = recent.map(r => ({
          performedAt: r.completedAt!.toISOString(),
          sets: recentSets.filter(s => s.workoutExerciseId === r.workoutExerciseId).map(s => ({ setType: s.setType, weightGrams: s.weightGrams, reps: s.reps, rir: s.rir, completed: s.completed })),
        }))
        const latest = recent[0]!
        recommendation = recommendProgression({ repsMin: latest.repsMin ?? 8, repsMax: latest.repsMax ?? 12, targetRir: latest.rir, targetSets: latest.targetSets ?? 3 }, history, incrementForExercise({ loadType, equipment: ex.equipment }), { loadType })
      }
      return {
        exerciseId,
        exerciseName: ex.nameDe,
        points,
        bests: { maxWeightGrams: best?.maxWeightGrams ?? 0, maxSetVolumeGrams: Number(best?.maxSetVolumeGrams ?? 0), maxSessionVolumeGrams: Number(best?.maxSessionVolumeGrams ?? 0), estimated1rmGrams: best?.estimated1rmGrams ?? 0 },
        recommendation,
      }
    },

    async records(userId: string, query: { limit: number; cursor?: string; exerciseId?: string }) {
      const cursor = decodeCursor<{ before: string }>(query.cursor)
      const where = [eq(personalRecords.userId, userId)]
      if (query.exerciseId) where.push(eq(personalRecords.exerciseId, query.exerciseId))
      if (cursor) where.push(sql`${personalRecords.achievedAt} < ${cursor.before}`)
      const rows = await db.select().from(personalRecords).where(and(...where)).orderBy(desc(personalRecords.achievedAt)).limit(query.limit + 1)
      const page = rows.slice(0, query.limit)
      const last = page[page.length - 1]
      return {
        items: page.map(r => ({ id: r.id, exerciseId: r.exerciseId, exerciseName: r.exerciseNameSnapshot, type: r.type, valueGrams: r.valueGrams === null ? null : Number(r.valueGrams), reps: r.reps, weightGrams: r.weightGrams, achievedAt: r.achievedAt.toISOString(), workoutId: r.workoutId, isEstimate: r.isEstimate })),
        nextCursor: rows.length > query.limit && last ? encodeCursor({ before: last.achievedAt.toISOString() }) : null,
      }
    },
  }
}
