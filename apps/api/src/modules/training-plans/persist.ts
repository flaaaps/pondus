import { asc, eq, inArray } from "drizzle-orm"
import type { DbOrTx } from "../../db/client.js"
import { exercises, trainingPlanExercises, trainingPlanSessions, trainingPlanVersions, trainingPlans } from "../../db/schema.js"
import { notFound } from "../../shared/errors.js"
import type { PlanDraft, PlanDto, PlanVersionDto, MuscleSlug } from "@pondus/shared"

/** Session keys to carry over, by draft session sequence. Sessions without an entry get a fresh key. */
export type SessionKeysBySequence = Map<number, string>

type DraftSession = PlanDraft["sessions"][number]

async function insertSessionExercises(tx: DbOrTx, sessionId: string, s: DraftSession) {
  if (!s.exercises.length) return
  await tx.insert(trainingPlanExercises).values(
    s.exercises.map(e => ({
      trainingPlanSessionId: sessionId,
      exerciseId: e.exerciseId,
      sequence: e.sequence,
      targetSets: e.targetSets,
      targetRepsMin: e.targetRepsMin,
      targetRepsMax: e.targetRepsMax,
      restSeconds: e.restSeconds,
      targetRir: e.targetRir,
      warmupSets: e.warmupSets,
      notes: e.notes,
    })),
  )
}

const sessionFields = (s: DraftSession) => ({
  name: s.name,
  sequence: s.sequence,
  weekday: s.weekday,
  focusMuscles: s.focusMuscles,
  estimatedDurationMinutes: s.estimatedDurationMinutes,
})

/**
 * Insert a full version (sessions + exercises) for a plan. Sessions listed in
 * `sessionKeys` keep their stable key so week overrides and linked workouts
 * still match them in the new version.
 */
export async function persistVersion(tx: DbOrTx, planId: string, versionNumber: number, draft: PlanDraft, changeReason: string, sessionKeys: SessionKeysBySequence = new Map()) {
  const [version] = await tx
    .insert(trainingPlanVersions)
    .values({
      trainingPlanId: planId,
      versionNumber,
      splitType: draft.splitType,
      weeklyFrequency: draft.weeklyFrequency,
      weeklySets: draft.weeklySets,
      rationale: draft.rationale,
      changeReason,
    })
    .returning()
  if (!version) throw new Error("version insert failed")
  const usedKeys = new Set<string>()
  for (const s of [...draft.sessions].sort((a, b) => a.sequence - b.sequence)) {
    const key = sessionKeys.get(s.sequence)
    const reuse = key && !usedKeys.has(key) ? key : undefined
    if (reuse) usedKeys.add(reuse)
    const [session] = await tx
      .insert(trainingPlanSessions)
      .values({ trainingPlanVersionId: version.id, ...(reuse ? { sessionKey: reuse } : {}), ...sessionFields(s) })
      .returning()
    if (!session) throw new Error("session insert failed")
    await insertSessionExercises(tx, session.id, s)
  }
  await tx.update(trainingPlans).set({ currentVersionNumber: versionNumber, updatedAt: new Date() }).where(eq(trainingPlans.id, planId))
  return version
}

/**
 * Overwrite the content of an existing (freshly edited) version in place.
 * Sessions matched by key keep their row id; their exercises are rewritten.
 * Used to coalesce rapid successive edits into one version.
 */
export async function replaceVersionContent(tx: DbOrTx, planId: string, versionId: string, draft: PlanDraft, sessionKeys: SessionKeysBySequence) {
  await tx
    .update(trainingPlanVersions)
    .set({ splitType: draft.splitType, weeklyFrequency: draft.weeklyFrequency, weeklySets: draft.weeklySets, rationale: draft.rationale })
    .where(eq(trainingPlanVersions.id, versionId))
  const existing = await tx.select().from(trainingPlanSessions).where(eq(trainingPlanSessions.trainingPlanVersionId, versionId))
  const byKey = new Map(existing.map(s => [s.sessionKey, s]))
  const kept = new Set<string>()
  for (const s of [...draft.sessions].sort((a, b) => a.sequence - b.sequence)) {
    const key = sessionKeys.get(s.sequence)
    const row = key && !kept.has(key) ? byKey.get(key) : undefined
    if (row) {
      kept.add(row.id)
      await tx.update(trainingPlanSessions).set(sessionFields(s)).where(eq(trainingPlanSessions.id, row.id))
      await tx.delete(trainingPlanExercises).where(eq(trainingPlanExercises.trainingPlanSessionId, row.id))
      await insertSessionExercises(tx, row.id, s)
    } else {
      const [session] = await tx.insert(trainingPlanSessions).values({ trainingPlanVersionId: versionId, ...sessionFields(s) }).returning()
      if (!session) throw new Error("session insert failed")
      await insertSessionExercises(tx, session.id, s)
    }
  }
  const removed = existing.filter(s => !kept.has(s.id)).map(s => s.id)
  if (removed.length) await tx.delete(trainingPlanSessions).where(inArray(trainingPlanSessions.id, removed))
  await tx.update(trainingPlans).set({ updatedAt: new Date() }).where(eq(trainingPlans.id, planId))
}

/** Map each session of an edited version (ids from `current` or temp ids) to the key it carries over, by sequence. */
export function carriedSessionKeys(current: PlanVersionDto, edited: { id: string; sequence: number }[]): SessionKeysBySequence {
  const keyById = new Map(current.sessions.map(s => [s.id, s.sessionKey]))
  const out: SessionKeysBySequence = new Map()
  for (const s of edited) {
    const key = keyById.get(s.id)
    if (key) out.set(s.sequence, key)
  }
  return out
}

/** Adjustments restructure the plan: carry keys over by sequence (session 1 stays session 1, …). */
export function sessionKeysBySequence(current: PlanVersionDto): SessionKeysBySequence {
  const out: SessionKeysBySequence = new Map()
  for (const s of current.sessions) if (s.sessionKey) out.set(s.sequence, s.sessionKey)
  return out
}

export async function loadVersionDto(db: DbOrTx, planId: string, versionNumber: number): Promise<PlanVersionDto> {
  const version = await db.query.trainingPlanVersions.findFirst({
    where: (v, { and, eq }) => and(eq(v.trainingPlanId, planId), eq(v.versionNumber, versionNumber)),
    with: { sessions: { orderBy: asc(trainingPlanSessions.sequence), with: { exercises: { orderBy: asc(trainingPlanExercises.sequence) } } } },
  })
  if (!version) throw notFound("Plan version")
  const exerciseIds = [...new Set(version.sessions.flatMap(s => s.exercises.map(e => e.exerciseId)))]
  const names = exerciseIds.length ? await db.select({ id: exercises.id, nameDe: exercises.nameDe }).from(exercises).where(inArray(exercises.id, exerciseIds)) : []
  const nameById = new Map(names.map(n => [n.id, n.nameDe]))
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    splitType: version.splitType,
    weeklyFrequency: version.weeklyFrequency,
    weeklySets: version.weeklySets,
    rationale: version.rationale,
    createdAt: version.createdAt.toISOString(),
    sessions: version.sessions.map(s => ({
      id: s.id,
      sessionKey: s.sessionKey,
      name: s.name,
      sequence: s.sequence,
      weekday: s.weekday,
      focusMuscles: s.focusMuscles,
      estimatedDurationMinutes: s.estimatedDurationMinutes,
      exercises: s.exercises.map(e => ({
        id: e.id,
        exerciseId: e.exerciseId,
        exerciseName: nameById.get(e.exerciseId) ?? "Unbekannte Übung",
        sequence: e.sequence,
        targetSets: e.targetSets,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        restSeconds: e.restSeconds,
        targetRir: e.targetRir,
        warmupSets: e.warmupSets,
        notes: e.notes,
      })),
    })),
  }
}

export async function loadPlanDto(db: DbOrTx, userId: string, planId: string): Promise<PlanDto> {
  const [plan] = await db.select().from(trainingPlans).where(eq(trainingPlans.id, planId))
  if (!plan || plan.userId !== userId) throw notFound("Plan")
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    status: plan.status,
    currentVersion: await loadVersionDto(db, plan.id, plan.currentVersionNumber),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}

/** Convert a stored version back into the planner's draft shape (ids dropped). */
export function versionToDraft(name: string, v: PlanVersionDto): PlanDraft {
  return {
    name,
    splitType: v.splitType,
    weeklyFrequency: v.weeklyFrequency,
    weeklySets: v.weeklySets as Record<MuscleSlug, number>,
    rationale: v.rationale,
    sessions: v.sessions.map(s => ({
      name: s.name,
      sequence: s.sequence,
      weekday: s.weekday,
      focusMuscles: s.focusMuscles as MuscleSlug[],
      estimatedDurationMinutes: s.estimatedDurationMinutes,
      exercises: s.exercises.map(e => ({
        exerciseId: e.exerciseId,
        sequence: e.sequence,
        targetSets: e.targetSets,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        restSeconds: e.restSeconds,
        targetRir: e.targetRir,
        warmupSets: e.warmupSets,
        notes: e.notes,
      })),
    })),
  }
}
