import { and, asc, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm"
import type { z } from "zod"
import type { Db, DbOrTx } from "../../db/client.js"
import {
  exerciseBests,
  exercises,
  personalRecords,
  trainingPlanExercises,
  trainingPlanSessions,
  trainingPlanVersions,
  trainingPlans,
  workoutExercises,
  workoutSets,
  workouts,
} from "../../db/schema.js"
import { badRequest, conflict, notFound } from "../../shared/errors.js"
import { decodeCursor, encodeCursor } from "../../shared/pagination.js"
import { toIso } from "../../shared/time.js"
import type { WorkoutNextTarget } from "../../db/schema.js"
import {
  accumulateBests,
  detectRecords,
  emptyBests,
  incrementForExercise,
  nextTargets,
  tonnageGrams,
  totalReps,
  workingSetCount,
  type ExerciseBests,
  type LoadType,
  type PerformanceSnapshot,
  type PerformedSet,
  type WorkoutDto,
  type WorkoutExerciseDto,
  type WorkoutSummaryDto,
  type addWorkoutExerciseBody,
  type completeWorkoutBody,
  type startWorkoutBody,
  type updateWorkoutBody,
  type updateWorkoutExerciseBody,
  type upsertSetBody,
  type workoutHistoryQuery,
} from "@pondus/shared"

type StartBody = z.infer<typeof startWorkoutBody>
type AddExerciseBody = z.infer<typeof addWorkoutExerciseBody>
type UpdateExerciseBody = z.infer<typeof updateWorkoutExerciseBody>
type UpsertSetBody = z.infer<typeof upsertSetBody>
type CompleteBody = z.infer<typeof completeWorkoutBody>
type UpdateBody = z.infer<typeof updateWorkoutBody>
type HistoryQuery = z.infer<typeof workoutHistoryQuery>

type WorkoutRow = typeof workouts.$inferSelect
type WorkoutExerciseRow = typeof workoutExercises.$inferSelect
type SetRow = typeof workoutSets.$inferSelect

const OPEN: WorkoutRow["status"][] = ["in_progress", "paused"]

function setToDto(s: SetRow) {
  return {
    id: s.id,
    clientId: s.clientId,
    setNumber: s.setNumber,
    setType: s.setType,
    weightGrams: s.weightGrams,
    reps: s.reps,
    rir: s.rir,
    rpe: s.rpe === null ? null : Number(s.rpe),
    completed: s.completed,
    completedAt: toIso(s.completedAt),
    notes: s.notes,
    targetWeightGrams: s.targetWeightGrams,
    targetReps: s.targetReps,
  }
}

function toPerformed(sets: SetRow[]): PerformedSet[] {
  return sets.map(s => ({ setType: s.setType, weightGrams: s.weightGrams, reps: s.reps, rir: s.rir, completed: s.completed }))
}

export function createWorkoutsService(db: Db) {
  async function ownedWorkout(tx: DbOrTx, userId: string, workoutId: string): Promise<WorkoutRow> {
    const [w] = await tx.select().from(workouts).where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    if (!w) throw notFound("Workout")
    return w
  }
  async function openWorkout(tx: DbOrTx, userId: string, workoutId: string): Promise<WorkoutRow> {
    const w = await ownedWorkout(tx, userId, workoutId)
    if (!OPEN.includes(w.status)) throw conflict("workout_not_open", `Workout is ${w.status}`)
    return w
  }

  /** Last completed performance of an exercise before `before`. */
  async function previousPerformance(tx: DbOrTx, userId: string, exerciseId: string, before: Date) {
    const [row] = await tx
      .select({ workoutExerciseId: workoutExercises.id, completedAt: workouts.completedAt })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), eq(workoutExercises.exerciseId, exerciseId), lt(workouts.completedAt, before), eq(workoutExercises.skipped, false)))
      .orderBy(desc(workouts.completedAt))
      .limit(1)
    if (!row) return null
    const sets = await tx.select().from(workoutSets).where(and(eq(workoutSets.workoutExerciseId, row.workoutExerciseId), eq(workoutSets.completed, true))).orderBy(asc(workoutSets.setNumber))
    if (!sets.length) return null
    return { performedAt: row.completedAt!.toISOString(), sets: sets.map(s => ({ setType: s.setType, weightGrams: s.weightGrams, reps: s.reps, rir: s.rir })) }
  }

  /** Last `limit` completed performances of an exercise before `before` (newest first), for progression. */
  async function recentPerformances(tx: DbOrTx, userId: string, exerciseId: string, before: Date, limit = 2): Promise<PerformanceSnapshot[]> {
    const rows = await tx
      .select({ workoutExerciseId: workoutExercises.id, completedAt: workouts.completedAt })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), eq(workoutExercises.exerciseId, exerciseId), lt(workouts.completedAt, before), eq(workoutExercises.skipped, false)))
      .orderBy(desc(workouts.completedAt))
      .limit(limit)
    if (!rows.length) return []
    const sets = await tx.select().from(workoutSets).where(and(inArray(workoutSets.workoutExerciseId, rows.map(r => r.workoutExerciseId)), eq(workoutSets.completed, true))).orderBy(asc(workoutSets.setNumber))
    return rows.map(r => ({ performedAt: r.completedAt!.toISOString(), sets: toPerformed(sets.filter(s => s.workoutExerciseId === r.workoutExerciseId)) }))
  }

  /** An exercise of the workout by server id or client id (the app only knows the client id until the first sync). */
  async function findExercise(tx: DbOrTx, workoutId: string, idOrClientId: string) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrClientId)
    const [row] = await tx
      .select()
      .from(workoutExercises)
      .where(and(eq(workoutExercises.workoutId, workoutId), isUuid ? or(eq(workoutExercises.id, idOrClientId), eq(workoutExercises.clientId, idOrClientId)) : eq(workoutExercises.clientId, idOrClientId)))
    return row ?? null
  }

  async function toDto(tx: DbOrTx, w: WorkoutRow): Promise<WorkoutDto> {
    const exRows = await tx.select().from(workoutExercises).where(eq(workoutExercises.workoutId, w.id)).orderBy(asc(workoutExercises.sequence))
    const setRows = exRows.length ? await tx.select().from(workoutSets).where(inArray(workoutSets.workoutExerciseId, exRows.map(e => e.id))).orderBy(asc(workoutSets.setNumber)) : []
    const exercisesDto: WorkoutExerciseDto[] = []
    for (const e of exRows) {
      exercisesDto.push({
        id: e.id,
        clientId: e.clientId,
        exerciseId: e.exerciseId,
        exerciseNameSnapshot: e.exerciseNameSnapshot,
        sequence: e.sequence,
        targetSets: e.targetSets,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        restSeconds: e.restSeconds,
        targetRir: e.targetRir,
        skipped: e.skipped,
        notes: e.notes,
        replacesWorkoutExerciseId: e.replacesWorkoutExerciseId,
        nextTarget: e.nextTarget ?? null,
        sets: setRows.filter(s => s.workoutExerciseId === e.id).map(setToDto),
        previous: e.exerciseId ? await previousPerformance(tx, w.userId, e.exerciseId, w.startedAt) : null,
      })
    }
    return {
      id: w.id,
      clientId: w.clientId,
      status: w.status,
      name: w.name,
      trainingPlanId: w.trainingPlanId,
      trainingPlanVersionId: w.trainingPlanVersionId,
      sourceSessionId: w.sourceSessionId,
      sourceSessionKey: w.sourceSessionKey,
      startedAt: w.startedAt.toISOString(),
      completedAt: toIso(w.completedAt),
      pausedAt: toIso(w.pausedAt),
      pausedSeconds: w.pausedSeconds,
      durationSeconds: w.durationSeconds,
      notes: w.notes,
      exercises: exercisesDto,
      updatedAt: w.updatedAt.toISOString(),
    }
  }

  async function loadTypes(tx: DbOrTx, ids: (string | null)[]): Promise<Map<string, LoadType>> {
    const unique = [...new Set(ids.filter((x): x is string => !!x))]
    if (!unique.length) return new Map()
    const rows = await tx.select({ id: exercises.id, loadType: exercises.loadType }).from(exercises).where(inArray(exercises.id, unique))
    return new Map(rows.map(r => [r.id, r.loadType as LoadType]))
  }

  async function touch(tx: DbOrTx, workoutId: string) {
    await tx.update(workouts).set({ updatedAt: new Date() }).where(eq(workouts.id, workoutId))
  }

  async function insertExerciseWithPrefill(
    tx: DbOrTx,
    userId: string,
    workoutId: string,
    startedAt: Date,
    input: { clientId: string | null; exerciseId: string; name: string; sequence: number; targetSets: number | null; targetRepsMin: number | null; targetRepsMax: number | null; restSeconds: number | null; targetRir: number | null; warmupSets?: number; replacesWorkoutExerciseId?: string | null },
  ): Promise<WorkoutExerciseRow> {
    const [row] = await tx
      .insert(workoutExercises)
      .values({
        workoutId,
        clientId: input.clientId,
        replacesWorkoutExerciseId: input.replacesWorkoutExerciseId ?? null,
        exerciseId: input.exerciseId,
        exerciseNameSnapshot: input.name,
        sequence: input.sequence,
        targetSets: input.targetSets,
        targetRepsMin: input.targetRepsMin,
        targetRepsMax: input.targetRepsMax,
        restSeconds: input.restSeconds,
        targetRir: input.targetRir,
      })
      .returning()
    if (!row) throw new Error("insert failed")
    // Pre-create planned sets so the user only taps "done".
    // - Without a rep range (free/added exercise): last performance as before.
    // - With a prescription (plan session, repeat): progression targets via nextTargets.
    //   target* = the target; weight/reps are prefilled with the target too (the DTO's
    //   `previous` still shows last time, `nextTarget.kind/reason` explains the change).
    //   If there is no usable history (no_data) or no target weight (bodyweight without
    //   added load), the weight falls back to the last logged weight (or stays empty).
    const prev = await previousPerformance(tx, userId, input.exerciseId, startedAt)
    const prevWorking = prev?.sets.filter(s => s.setType === "working") ?? []
    const plannedSets = input.targetSets ?? 0
    const warmups = input.warmupSets ?? 0
    let target: WorkoutNextTarget | null = null
    if (plannedSets > 0 && input.targetRepsMin !== null && input.targetRepsMax !== null) {
      const [ex] = await tx.select({ loadType: exercises.loadType, equipment: exercises.equipment }).from(exercises).where(eq(exercises.id, input.exerciseId))
      if (ex) {
        const increment = incrementForExercise(ex)
        const history = await recentPerformances(tx, userId, input.exerciseId, startedAt)
        target = nextTargets(
          { repsMin: input.targetRepsMin, repsMax: input.targetRepsMax, targetRir: input.targetRir, targetSets: plannedSets, incrementGrams: increment, roundingStepGrams: increment > 0 ? increment : undefined },
          history,
          { loadType: ex.loadType as LoadType },
        )
        await tx.update(workoutExercises).set({ nextTarget: target }).where(eq(workoutExercises.id, row.id))
      }
    }
    const rows: (typeof workoutSets.$inferInsert)[] = []
    for (let i = 0; i < warmups; i++) rows.push({ workoutExerciseId: row.id, clientId: `${row.id}-w${i + 1}`, setNumber: i + 1, setType: "warmup", targetWeightGrams: null, targetReps: null })
    for (let i = 0; i < plannedSets; i++) {
      const p = prevWorking[i] ?? prevWorking[prevWorking.length - 1]
      const weight = target?.weightGrams ?? p?.weightGrams ?? null
      const reps = target?.repsPerSet[i] ?? p?.reps ?? input.targetRepsMin
      rows.push({
        workoutExerciseId: row.id,
        clientId: `${row.id}-s${i + 1}`,
        setNumber: warmups + i + 1,
        setType: "working",
        targetWeightGrams: weight,
        targetReps: reps,
        weightGrams: weight,
        reps,
      })
    }
    if (rows.length) await tx.insert(workoutSets).values(rows)
    return row
  }

  return {
    toDto: (w: WorkoutRow) => toDto(db, w),

    async start(userId: string, body: StartBody): Promise<{ workout: WorkoutDto; created: boolean }> {
      return db.transaction(async tx => {
        const [existing] = await tx.select().from(workouts).where(and(eq(workouts.userId, userId), eq(workouts.clientId, body.clientId)))
        if (existing) return { workout: await toDto(tx, existing), created: false }
        const [open] = await tx.select().from(workouts).where(and(eq(workouts.userId, userId), inArray(workouts.status, OPEN)))
        if (open) throw conflict("workout_already_active", "Finish or cancel the active workout first", { workoutId: open.id })

        const startedAt = body.startedAt ? new Date(body.startedAt) : new Date()
        let name = "Freies Training"
        let planId: string | null = null
        let versionId: string | null = null
        let sessionId: string | null = null
        let sessionKey: string | null = null
        const planned: Parameters<typeof insertExerciseWithPrefill>[4][] = []

        if (body.source.type === "plan_session") {
          const [session] = await tx
            .select({ s: trainingPlanSessions, v: trainingPlanVersions, p: trainingPlans })
            .from(trainingPlanSessions)
            .innerJoin(trainingPlanVersions, eq(trainingPlanVersions.id, trainingPlanSessions.trainingPlanVersionId))
            .innerJoin(trainingPlans, eq(trainingPlans.id, trainingPlanVersions.trainingPlanId))
            .where(and(eq(trainingPlanSessions.id, body.source.planSessionId), eq(trainingPlans.userId, userId)))
          if (!session) throw notFound("Plan session")
          name = session.s.name
          planId = session.p.id
          versionId = session.v.id
          sessionId = session.s.id
          sessionKey = session.s.sessionKey
          const planEx = await tx
            .select({ e: trainingPlanExercises, name: exercises.nameDe })
            .from(trainingPlanExercises)
            .innerJoin(exercises, eq(exercises.id, trainingPlanExercises.exerciseId))
            .where(eq(trainingPlanExercises.trainingPlanSessionId, session.s.id))
            .orderBy(asc(trainingPlanExercises.sequence))
          planEx.forEach((pe, i) =>
            planned.push({
              clientId: null,
              exerciseId: pe.e.exerciseId,
              name: pe.name,
              sequence: i + 1,
              targetSets: pe.e.targetSets,
              targetRepsMin: pe.e.targetRepsMin,
              targetRepsMax: pe.e.targetRepsMax,
              restSeconds: pe.e.restSeconds,
              targetRir: pe.e.targetRir,
              warmupSets: pe.e.warmupSets,
            }),
          )
        } else if (body.source.type === "repeat_workout") {
          const src = await ownedWorkout(tx, userId, body.source.workoutId)
          name = src.name
          planId = src.trainingPlanId
          versionId = src.trainingPlanVersionId
          sessionId = src.sourceSessionId
          sessionKey = src.sourceSessionKey
          const srcEx = await tx.select().from(workoutExercises).where(and(eq(workoutExercises.workoutId, src.id), eq(workoutExercises.skipped, false))).orderBy(asc(workoutExercises.sequence))
          srcEx.forEach((e, i) => {
            if (!e.exerciseId) return
            planned.push({ clientId: null, exerciseId: e.exerciseId, name: e.exerciseNameSnapshot, sequence: i + 1, targetSets: e.targetSets ?? 3, targetRepsMin: e.targetRepsMin, targetRepsMax: e.targetRepsMax, restSeconds: e.restSeconds, targetRir: e.targetRir })
          })
        } else if (body.source.type === "plan_session_client") {
          const [session] = await tx
            .select({ s: trainingPlanSessions, v: trainingPlanVersions, p: trainingPlans })
            .from(trainingPlanSessions)
            .innerJoin(trainingPlanVersions, eq(trainingPlanVersions.id, trainingPlanSessions.trainingPlanVersionId))
            .innerJoin(trainingPlans, eq(trainingPlans.id, trainingPlanVersions.trainingPlanId))
            .where(and(eq(trainingPlanSessions.id, body.source.planSessionId), eq(trainingPlans.userId, userId)))
          if (!session) throw notFound("Plan session")
          name = body.source.name
          planId = session.p.id
          versionId = session.v.id
          sessionId = session.s.id
          sessionKey = session.s.sessionKey
        } else if (body.source.name) {
          name = body.source.name
        }

        const [w] = await tx
          .insert(workouts)
          .values({ userId, clientId: body.clientId, name, status: "in_progress", trainingPlanId: planId, trainingPlanVersionId: versionId, sourceSessionId: sessionId, sourceSessionKey: sessionKey, startedAt })
          .returning()
        if (!w) throw new Error("insert failed")
        for (const p of planned) await insertExerciseWithPrefill(tx, userId, w.id, startedAt, p)
        return { workout: await toDto(tx, w), created: true }
      })
    },

    async active(userId: string): Promise<WorkoutDto | null> {
      const [w] = await db.select().from(workouts).where(and(eq(workouts.userId, userId), inArray(workouts.status, OPEN))).orderBy(desc(workouts.startedAt)).limit(1)
      return w ? toDto(db, w) : null
    },

    async get(userId: string, workoutId: string) {
      return toDto(db, await ownedWorkout(db, userId, workoutId))
    },

    async byClientId(userId: string, clientId: string): Promise<WorkoutRow | null> {
      const [w] = await db.select().from(workouts).where(and(eq(workouts.userId, userId), eq(workouts.clientId, clientId)))
      return w ?? null
    },

    async update(userId: string, workoutId: string, body: UpdateBody) {
      const w = await ownedWorkout(db, userId, workoutId)
      await db.update(workouts).set({ ...body, updatedAt: new Date() }).where(eq(workouts.id, w.id))
      return this.get(userId, workoutId)
    },

    async addExercise(userId: string, workoutId: string, body: AddExerciseBody) {
      return db.transaction(async tx => {
        const w = await openWorkout(tx, userId, workoutId)
        const [dup] = await tx.select().from(workoutExercises).where(and(eq(workoutExercises.workoutId, w.id), eq(workoutExercises.clientId, body.clientId)))
        if (dup) return toDto(tx, w)
        const [ex] = await tx.select().from(exercises).where(and(eq(exercises.id, body.exerciseId), isNull(exercises.deletedAt), or(eq(exercises.isSystem, true), eq(exercises.ownerUserId, userId))))
        if (!ex) throw badRequest("unknown_exercise", "Exercise not found")
        let sequence: number
        let replaces: string | null = null
        if (body.replacesWorkoutExerciseId) {
          // The app addresses exercises by client id once it created them itself (their server id is only known after a sync).
          const old = await findExercise(tx, w.id, body.replacesWorkoutExerciseId)
          if (!old) throw notFound("Workout exercise")
          await tx.update(workoutExercises).set({ skipped: true, updatedAt: new Date() }).where(eq(workoutExercises.id, old.id))
          await tx.execute(sql`update workout_exercises set sequence = sequence + 1 where workout_id = ${w.id} and sequence > ${old.sequence}`)
          sequence = old.sequence + 1
          replaces = old.id
        } else {
          const maxRows = await tx.select({ max: sql<number>`coalesce(max(sequence), 0)::int` }).from(workoutExercises).where(eq(workoutExercises.workoutId, w.id))
          sequence = (maxRows[0]?.max ?? 0) + 1
        }
        await insertExerciseWithPrefill(tx, userId, w.id, w.startedAt, {
          clientId: body.clientId,
          exerciseId: ex.id,
          name: ex.nameDe,
          replacesWorkoutExerciseId: replaces,
          sequence: body.sequence ?? sequence,
          targetSets: body.targetSets ?? 3,
          targetRepsMin: body.targetRepsMin ?? null,
          targetRepsMax: body.targetRepsMax ?? null,
          restSeconds: body.restSeconds ?? 120,
          targetRir: body.targetRir ?? null,
          warmupSets: body.warmupSets ?? 0,
        })
        await touch(tx, w.id)
        return toDto(tx, w)
      })
    },

    async updateExercise(userId: string, workoutId: string, workoutExerciseId: string, body: UpdateExerciseBody) {
      return db.transaction(async tx => {
        const w = await openWorkout(tx, userId, workoutId)
        const row = await findExercise(tx, w.id, workoutExerciseId)
        if (!row) throw notFound("Workout exercise")
        await tx.update(workoutExercises).set({ ...body, updatedAt: new Date() }).where(eq(workoutExercises.id, row.id))
        await touch(tx, w.id)
        return toDto(tx, w)
      })
    },

    /** Drops an exercise with its sets and closes the gap in the sequence. Idempotent: unknown ids are a no-op. */
    async removeExercise(userId: string, workoutId: string, workoutExerciseId: string) {
      return db.transaction(async tx => {
        const w = await openWorkout(tx, userId, workoutId)
        const row = await findExercise(tx, w.id, workoutExerciseId)
        if (row) {
          await tx.delete(workoutExercises).where(eq(workoutExercises.id, row.id))
          await tx.update(workoutExercises).set({ replacesWorkoutExerciseId: null }).where(and(eq(workoutExercises.workoutId, w.id), eq(workoutExercises.replacesWorkoutExerciseId, row.id)))
          await tx.execute(sql`update workout_exercises set sequence = sequence - 1 where workout_id = ${w.id} and sequence > ${row.sequence}`)
        }
        await touch(tx, w.id)
        return toDto(tx, w)
      })
    },

    /** Idempotent set write keyed by clientId; the newest client timestamp wins. */
    async upsertSet(userId: string, workoutId: string, workoutExerciseId: string, body: UpsertSetBody) {
      return db.transaction(async tx => {
        const w = await ownedWorkout(tx, userId, workoutId)
        const [ex] = await tx.select().from(workoutExercises).where(and(eq(workoutExercises.id, workoutExerciseId), eq(workoutExercises.workoutId, w.id)))
        if (!ex) throw notFound("Workout exercise")
        const clientUpdatedAt = new Date(body.updatedAt)
        const [existing] = await tx.select().from(workoutSets).where(and(eq(workoutSets.workoutExerciseId, ex.id), eq(workoutSets.clientId, body.clientId)))
        if (existing?.clientUpdatedAt && existing.clientUpdatedAt >= clientUpdatedAt) {
          // Replay of an already-applied write (or a stale one from another device): keep the server copy.
          return { workout: await toDto(tx, w), applied: false }
        }
        if (!OPEN.includes(w.status)) throw conflict("workout_not_open", `Workout is ${w.status}`)
        const values = {
          setNumber: body.setNumber,
          setType: body.setType,
          weightGrams: body.weightGrams,
          reps: body.reps,
          rir: body.rir,
          rpe: body.rpe === null ? null : String(body.rpe),
          completed: body.completed,
          completedAt: body.completedAt ? new Date(body.completedAt) : body.completed ? new Date() : null,
          notes: body.notes,
          clientUpdatedAt,
          updatedAt: new Date(),
        }
        if (existing) {
          await tx.update(workoutSets).set(values).where(eq(workoutSets.id, existing.id))
        } else {
          await tx.insert(workoutSets).values({ workoutExerciseId: ex.id, clientId: body.clientId, ...values })
        }
        await touch(tx, w.id)
        return { workout: await toDto(tx, w), applied: true }
      })
    },

    async deleteSet(userId: string, workoutId: string, setIdOrClientId: string) {
      return db.transaction(async tx => {
        const w = await openWorkout(tx, userId, workoutId)
        const exIds = (await tx.select({ id: workoutExercises.id }).from(workoutExercises).where(eq(workoutExercises.workoutId, w.id))).map(r => r.id)
        if (exIds.length) {
          const isUuid = /^[0-9a-f-]{36}$/i.test(setIdOrClientId)
          await tx.delete(workoutSets).where(and(inArray(workoutSets.workoutExerciseId, exIds), isUuid ? or(eq(workoutSets.id, setIdOrClientId), eq(workoutSets.clientId, setIdOrClientId)) : eq(workoutSets.clientId, setIdOrClientId)))
        }
        await touch(tx, w.id)
        return toDto(tx, w)
      })
    },

    async pause(userId: string, workoutId: string, at?: string) {
      const w = await openWorkout(db, userId, workoutId)
      if (w.status === "paused") return toDto(db, w)
      await db.update(workouts).set({ status: "paused", pausedAt: at ? new Date(at) : new Date(), updatedAt: new Date() }).where(eq(workouts.id, w.id))
      return this.get(userId, workoutId)
    },

    async resume(userId: string, workoutId: string, at?: string) {
      const w = await openWorkout(db, userId, workoutId)
      if (w.status !== "paused" || !w.pausedAt) return toDto(db, w)
      const now = at ? new Date(at) : new Date()
      const extra = Math.max(0, Math.round((now.getTime() - w.pausedAt.getTime()) / 1000))
      await db.update(workouts).set({ status: "in_progress", pausedAt: null, pausedSeconds: w.pausedSeconds + extra, updatedAt: new Date() }).where(eq(workouts.id, w.id))
      return this.get(userId, workoutId)
    },

    async cancel(userId: string, workoutId: string) {
      const w = await ownedWorkout(db, userId, workoutId)
      if (w.status === "completed") throw conflict("workout_completed", "Completed workouts cannot be cancelled")
      await db.update(workouts).set({ status: "cancelled", updatedAt: new Date() }).where(eq(workouts.id, w.id))
      return this.get(userId, workoutId)
    },

    async complete(userId: string, workoutId: string, body: CompleteBody): Promise<WorkoutSummaryDto> {
      return db.transaction(async tx => {
        const w = await ownedWorkout(tx, userId, workoutId)
        if (w.status === "completed") return summarise(tx, w) // idempotent
        if (w.status === "cancelled") throw conflict("workout_cancelled", "Cancelled workouts cannot be completed")
        const completedAt = body.completedAt ? new Date(body.completedAt) : new Date()
        let pausedSeconds = w.pausedSeconds
        if (w.status === "paused" && w.pausedAt) pausedSeconds += Math.max(0, Math.round((completedAt.getTime() - w.pausedAt.getTime()) / 1000))
        const durationSeconds = Math.max(0, Math.round((completedAt.getTime() - w.startedAt.getTime()) / 1000) - pausedSeconds)

        // Drop never-touched placeholder sets so history only contains real work.
        const exIds = (await tx.select({ id: workoutExercises.id }).from(workoutExercises).where(eq(workoutExercises.workoutId, w.id))).map(r => r.id)
        if (exIds.length) await tx.delete(workoutSets).where(and(inArray(workoutSets.workoutExerciseId, exIds), eq(workoutSets.completed, false)))

        const [updated] = await tx
          .update(workouts)
          .set({ status: "completed", completedAt, pausedAt: null, pausedSeconds, durationSeconds, notes: body.notes === undefined ? w.notes : body.notes, updatedAt: new Date() })
          .where(eq(workouts.id, w.id))
          .returning()
        if (!updated) throw new Error("update failed")

        // Personal records per exercise, compared against bests *before* this workout.
        const exRows = await tx.select().from(workoutExercises).where(and(eq(workoutExercises.workoutId, w.id), eq(workoutExercises.skipped, false)))
        const loadTypeById = await loadTypes(tx, exRows.map(e => e.exerciseId))
        for (const e of exRows) {
          if (!e.exerciseId) continue
          const sets = await tx.select().from(workoutSets).where(eq(workoutSets.workoutExerciseId, e.id))
          const performed = toPerformed(sets)
          if (!performed.some(s => s.completed && s.setType !== "warmup")) continue
          const [bestRow] = await tx.select().from(exerciseBests).where(and(eq(exerciseBests.userId, userId), eq(exerciseBests.exerciseId, e.exerciseId)))
          const previous: ExerciseBests = bestRow
            ? { maxWeightGrams: bestRow.maxWeightGrams, repsAtWeight: bestRow.repsAtWeight, maxSetVolumeGrams: bestRow.maxSetVolumeGrams, maxSessionVolumeGrams: bestRow.maxSessionVolumeGrams, estimated1rmGrams: bestRow.estimated1rmGrams }
            : emptyBests()
          const opts = { loadType: loadTypeById.get(e.exerciseId) }
          const events = detectRecords(previous, performed, opts)
          if (events.length) {
            await tx.insert(personalRecords).values(
              events.map(ev => ({
                userId,
                exerciseId: e.exerciseId,
                exerciseNameSnapshot: e.exerciseNameSnapshot,
                type: ev.type,
                valueGrams: ev.valueGrams,
                reps: ev.reps,
                weightGrams: ev.weightGrams,
                workoutId: w.id,
                achievedAt: completedAt,
                isEstimate: ev.isEstimate,
              })),
            )
          }
          const next = accumulateBests(previous, performed, opts)
          await tx
            .insert(exerciseBests)
            .values({ userId, exerciseId: e.exerciseId, ...next, updatedAt: new Date() })
            .onConflictDoUpdate({ target: [exerciseBests.userId, exerciseBests.exerciseId], set: { ...next, updatedAt: new Date() } })
        }
        return summarise(tx, updated)
      })
    },

    summary: async (userId: string, workoutId: string) => {
      const w = await ownedWorkout(db, userId, workoutId)
      if (w.status !== "completed") throw conflict("workout_not_completed", "Summary is available after completion")
      return summarise(db, w)
    },

    async history(userId: string, query: HistoryQuery) {
      const cursor = decodeCursor<{ before: string }>(query.cursor)
      const where = [eq(workouts.userId, userId), query.status ? eq(workouts.status, query.status) : ne(workouts.status, "cancelled")]
      if (query.from) where.push(sql`${workouts.startedAt} >= ${query.from}`)
      if (query.to) where.push(sql`${workouts.startedAt} <= ${query.to}`)
      if (cursor) where.push(sql`${workouts.startedAt} < ${cursor.before}`)
      if (query.exerciseId) where.push(sql`exists (select 1 from workout_exercises we where we.workout_id = ${workouts.id} and we.exercise_id = ${query.exerciseId})`)
      const rows = await db.select().from(workouts).where(and(...where)).orderBy(desc(workouts.startedAt)).limit(query.limit + 1)
      const page = rows.slice(0, query.limit)
      const stats = page.length
        ? await db
            .select({
              workoutId: workoutExercises.workoutId,
              workingSets: sql<number>`count(*) filter (where ${workoutSets.completed} and ${workoutSets.setType} <> 'warmup')::int`,
              // Assisted sets log assistance, not load → no tonnage (body weight unknown).
              tonnage: sql<number>`coalesce(sum(case when ${workoutSets.completed} and ${workoutSets.setType} <> 'warmup' and coalesce(${exercises.loadType}::text, '') <> 'assisted' then coalesce(${workoutSets.weightGrams},0) * coalesce(${workoutSets.reps},0) else 0 end), 0)::bigint`,
              exerciseCount: sql<number>`count(distinct ${workoutExercises.id}) filter (where ${workoutExercises.skipped} = false)::int`,
            })
            .from(workoutExercises)
            .leftJoin(workoutSets, eq(workoutSets.workoutExerciseId, workoutExercises.id))
            .leftJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
            .where(inArray(workoutExercises.workoutId, page.map(p => p.id)))
            .groupBy(workoutExercises.workoutId)
        : []
      const statById = new Map(stats.map(s => [s.workoutId, s]))
      const items = page.map(w => ({
        id: w.id,
        name: w.name,
        status: w.status,
        startedAt: w.startedAt.toISOString(),
        completedAt: toIso(w.completedAt),
        durationSeconds: w.durationSeconds,
        workingSets: statById.get(w.id)?.workingSets ?? 0,
        tonnageGrams: Number(statById.get(w.id)?.tonnage ?? 0),
        exerciseCount: statById.get(w.id)?.exerciseCount ?? 0,
        sourceSessionId: w.sourceSessionId,
      }))
      const last = page[page.length - 1]
      return { items, nextCursor: rows.length > query.limit && last ? encodeCursor({ before: last.startedAt.toISOString() }) : null }
    },
  }

  async function summarise(tx: DbOrTx, w: WorkoutRow): Promise<WorkoutSummaryDto> {
    const dto = await toDto(tx, w)
    const toLogged = async (d: WorkoutDto) => {
      const lt = await loadTypes(tx, d.exercises.map(e => e.exerciseId))
      return d.exercises.filter(e => !e.skipped).flatMap(e => e.sets.map(s => ({ setType: s.setType, weightGrams: s.weightGrams, reps: s.reps, completed: s.completed, loadType: e.exerciseId ? lt.get(e.exerciseId) : undefined })))
    }
    const allSets = await toLogged(dto)
    const records = await tx.select().from(personalRecords).where(eq(personalRecords.workoutId, w.id))
    // Compare with the previous completed workout of the same session (or same name).
    const [prev] = await tx
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, w.userId),
          eq(workouts.status, "completed"),
          ne(workouts.id, w.id),
          lt(workouts.startedAt, w.startedAt),
          w.sourceSessionKey ? eq(workouts.sourceSessionKey, w.sourceSessionKey) : w.sourceSessionId ? eq(workouts.sourceSessionId, w.sourceSessionId) : eq(workouts.name, w.name),
        ),
      )
      .orderBy(desc(workouts.startedAt))
      .limit(1)
    let comparison: WorkoutSummaryDto["comparison"] = null
    if (prev) {
      const prevDto = await toDto(tx, prev)
      const prevSets = await toLogged(prevDto)
      comparison = { workoutId: prev.id, completedAt: prev.completedAt!.toISOString(), durationSeconds: prev.durationSeconds, workingSets: workingSetCount(prevSets), tonnageGrams: tonnageGrams(prevSets) }
    }
    return {
      workout: dto,
      durationSeconds: w.durationSeconds ?? 0,
      exercisesCompleted: dto.exercises.filter(e => !e.skipped && e.sets.some(s => s.completed)).length,
      workingSets: workingSetCount(allSets),
      totalReps: totalReps(allSets),
      tonnageGrams: tonnageGrams(allSets),
      records: records.map(r => ({ type: r.type, exerciseId: r.exerciseId, exerciseName: r.exerciseNameSnapshot, valueGrams: r.valueGrams === null ? null : Number(r.valueGrams), reps: r.reps, weightGrams: r.weightGrams, previousValue: null, isEstimate: r.isEstimate })),
      comparison,
    }
  }
}

export type WorkoutsService = ReturnType<typeof createWorkoutsService>
