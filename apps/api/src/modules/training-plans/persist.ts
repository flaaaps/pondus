import { asc, eq, inArray } from "drizzle-orm"
import type { DbOrTx } from "../../db/client.js"
import { exercises, trainingPlanExercises, trainingPlanSessions, trainingPlanVersions, trainingPlans } from "../../db/schema.js"
import { notFound } from "../../shared/errors.js"
import type { PlanDraft, PlanDto, PlanVersionDto, MuscleSlug } from "@pondus/shared"

/** Insert a full version (sessions + exercises) for a plan. Versions are immutable once written. */
export async function persistVersion(tx: DbOrTx, planId: string, versionNumber: number, draft: PlanDraft, changeReason: string) {
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
  for (const s of [...draft.sessions].sort((a, b) => a.sequence - b.sequence)) {
    const [session] = await tx
      .insert(trainingPlanSessions)
      .values({
        trainingPlanVersionId: version.id,
        name: s.name,
        sequence: s.sequence,
        weekday: s.weekday,
        focusMuscles: s.focusMuscles,
        estimatedDurationMinutes: s.estimatedDurationMinutes,
      })
      .returning()
    if (!session) throw new Error("session insert failed")
    if (s.exercises.length) {
      await tx.insert(trainingPlanExercises).values(
        s.exercises.map(e => ({
          trainingPlanSessionId: session.id,
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
  }
  await tx.update(trainingPlans).set({ currentVersionNumber: versionNumber, updatedAt: new Date() }).where(eq(trainingPlans.id, planId))
  return version
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
