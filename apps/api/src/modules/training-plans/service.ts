import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm"
import type { z } from "zod"
import type { Db, DbOrTx } from "../../db/client.js"
import { planAdjustmentPreviews, sessionOverrides, trainingPlanExercises, trainingPlanSessions, trainingPlanVersions, trainingPlans, userTrainingProfiles, workouts } from "../../db/schema.js"
import { badRequest, conflict, notFound } from "../../shared/errors.js"
import { addDaysISO, localDateISO, resolveTimeZone, weekStartISO } from "../../shared/time.js"
import { loadExerciseRefs } from "../exercises/repo.js"
import { loadTrainingProfile } from "../users/service.js"
import { applyEditOps } from "./edit.js"
import { carriedSessionKeys, loadPlanDto, loadVersionDto, persistVersion, replaceVersionContent, sessionKeysBySequence, versionToDraft } from "./persist.js"
import {
  defaultPlanName,
  generatePlan,
  proposeAdjustedPlan,
  recomputePlan,
  type AdjustmentPreviewDto,
  type PlanDiff,
  type PlanDraft,
  type PlanEditOp,
  type PlanWeekDto,
  type TrainingProfile,
  type generatePlanBody,
  type previewAdjustmentBody,
  type sessionOverrideBody,
} from "@pondus/shared"

type GenerateBody = z.infer<typeof generatePlanBody>
type PreviewBody = z.infer<typeof previewAdjustmentBody>
type OverrideBody = z.infer<typeof sessionOverrideBody>

const PREVIEW_TTL_MS = 30 * 60 * 1000
/** Successive edits within this window update the version they just created instead of adding another one. */
export const EDIT_COALESCE_WINDOW_MS = 120 * 1000

export function createPlansService(db: Db) {
  async function ownedPlan(userId: string, planId: string) {
    const [plan] = await db.select().from(trainingPlans).where(and(eq(trainingPlans.id, planId), eq(trainingPlans.userId, userId)))
    if (!plan) throw notFound("Plan")
    return plan
  }

  async function activePlan(userId: string) {
    const [plan] = await db.select().from(trainingPlans).where(and(eq(trainingPlans.userId, userId), eq(trainingPlans.status, "active")))
    return plan ?? null
  }

  async function profileWithPatch(userId: string, patch: Partial<Pick<TrainingProfile, "weeklyFrequency" | "sessionDurationMinutes">>) {
    const profile = await loadTrainingProfile(db, userId)
    return { ...profile, ...stripUndefined(patch) }
  }

  return {
    async list(userId: string) {
      const rows = await db.select().from(trainingPlans).where(and(eq(trainingPlans.userId, userId))).orderBy(desc(trainingPlans.updatedAt))
      const versions = rows.length
        ? await db
            .select()
            .from(trainingPlanVersions)
            .where(inArray(trainingPlanVersions.trainingPlanId, rows.map(r => r.id)))
        : []
      return rows.map(p => {
        const v = versions.find(x => x.trainingPlanId === p.id && x.versionNumber === p.currentVersionNumber)
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          splitType: v?.splitType ?? "custom",
          weeklyFrequency: v?.weeklyFrequency ?? 0,
          versionNumber: p.currentVersionNumber,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }
      })
    },

    async get(userId: string, planId: string) {
      return loadPlanDto(db, userId, planId)
    },

    async getActive(userId: string) {
      const plan = await activePlan(userId)
      return plan ? loadPlanDto(db, userId, plan.id) : null
    },

    async getVersion(userId: string, planId: string, versionNumber: number) {
      await ownedPlan(userId, planId)
      return loadVersionDto(db, planId, versionNumber)
    },

    async generate(userId: string, body: GenerateBody) {
      const profile = await loadTrainingProfile(db, userId)
      const refs = await loadExerciseRefs(db, userId)
      const draft = generatePlan(profile, refs, { splitType: body.splitType, name: body.name })
      if (!draft.sessions.some(s => s.exercises.length)) throw badRequest("no_exercises", "No exercises match your equipment and preferences")
      const planId = await db.transaction(async tx => {
        if (body.activate) await tx.update(trainingPlans).set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(trainingPlans.userId, userId), eq(trainingPlans.status, "active")))
        const [plan] = await tx
          .insert(trainingPlans)
          .values({ userId, name: draft.name, description: draft.rationale[0]?.body ?? null, status: body.activate ? "active" : "draft", currentVersionNumber: 1 })
          .returning()
        if (!plan) throw new Error("insert failed")
        await persistVersion(tx, plan.id, 1, draft, "generated")
        return plan.id
      })
      return loadPlanDto(db, userId, planId)
    },

    async activate(userId: string, planId: string) {
      const plan = await ownedPlan(userId, planId)
      await db.transaction(async tx => {
        await tx.update(trainingPlans).set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(trainingPlans.userId, userId), eq(trainingPlans.status, "active"), ne(trainingPlans.id, plan.id)))
        await tx.update(trainingPlans).set({ status: "active", archivedAt: null, updatedAt: new Date() }).where(eq(trainingPlans.id, plan.id))
      })
      return loadPlanDto(db, userId, planId)
    },

    async archive(userId: string, planId: string) {
      const plan = await ownedPlan(userId, planId)
      await db.update(trainingPlans).set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() }).where(eq(trainingPlans.id, plan.id))
      return loadPlanDto(db, userId, planId)
    },

    /**
     * Edits create a new version; completed workouts keep pointing at the old one.
     * Sessions keep their sessionKey so this week's overrides and workouts still match.
     * Rapid follow-up edits (same plan, within EDIT_COALESCE_WINDOW_MS of the version an
     * edit created, nothing linked to it yet) update that version in place, keeping its
     * session ids, instead of producing v3, v4, v5 … within minutes.
     */
    async edit(userId: string, planId: string, ops: PlanEditOp[]) {
      await ownedPlan(userId, planId)
      const refs = await loadExerciseRefs(db, userId)
      const profile = await loadTrainingProfile(db, userId)
      await db.transaction(async tx => {
        // Serialise concurrent edits of the same plan.
        const [plan] = await tx.select().from(trainingPlans).where(and(eq(trainingPlans.id, planId), eq(trainingPlans.userId, userId))).for("update")
        if (!plan) throw notFound("Plan")
        const current = await loadVersionDto(tx, planId, plan.currentVersionNumber)
        const { version, planName } = applyEditOps(current, plan.name, ops, new Map(refs.map(r => [r.id, r])), profile.primaryGoal, profile.experienceLevel)
        const draft = recomputePlan(versionToDraft(planName, version), refs)
        const keys = carriedSessionKeys(current, version.sessions)
        if (await canCoalesceEdit(tx, planId, current.id, plan.currentVersionNumber)) await replaceVersionContent(tx, planId, current.id, draft, keys)
        else await persistVersion(tx, planId, plan.currentVersionNumber + 1, draft, "edited", keys)
        if (planName !== plan.name) await tx.update(trainingPlans).set({ name: planName }).where(eq(trainingPlans.id, planId))
      })
      return loadPlanDto(db, userId, planId)
    },

    /** Propose a restructured plan (frequency / duration / split change) without saving it. */
    async previewAdjustment(userId: string, planId: string, body: PreviewBody): Promise<AdjustmentPreviewDto> {
      const plan = await ownedPlan(userId, planId)
      const current = await loadVersionDto(db, planId, plan.currentVersionNumber)
      const refs = await loadExerciseRefs(db, userId)
      const profile = await profileWithPatch(userId, { weeklyFrequency: body.weeklyFrequency, sessionDurationMinutes: body.sessionDurationMinutes })
      const { proposal, diff } = proposeAdjustedPlan(versionToDraft(plan.name, current), profile, refs, { splitType: body.splitType, weekdays: body.weekdays })
      const profilePatch = body.updateProfile ? stripUndefined({ weeklyFrequency: body.weeklyFrequency, sessionDurationMinutes: body.sessionDurationMinutes }) : {}
      const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS)
      const [row] = await db
        .insert(planAdjustmentPreviews)
        .values({ userId, trainingPlanId: planId, baseVersionNumber: plan.currentVersionNumber, proposal, diff, profilePatch, expiresAt })
        .returning()
      if (!row) throw new Error("insert failed")
      return { previewId: row.id, expiresAt: expiresAt.toISOString(), proposal: proposalDto(proposal, refs), diff }
    },

    async applyPreview(userId: string, planId: string, previewId: string) {
      const plan = await ownedPlan(userId, planId)
      const [preview] = await db.select().from(planAdjustmentPreviews).where(and(eq(planAdjustmentPreviews.id, previewId), eq(planAdjustmentPreviews.userId, userId), eq(planAdjustmentPreviews.trainingPlanId, planId)))
      if (!preview) throw notFound("Preview")
      if (preview.appliedAt) throw conflict("preview_applied", "This preview was already applied")
      if (preview.expiresAt < new Date()) throw conflict("preview_expired", "This preview has expired, please create a new one")
      if (preview.baseVersionNumber !== plan.currentVersionNumber) throw conflict("plan_changed", "The plan changed since this preview was created")
      const proposal = preview.proposal as PlanDraft
      const current = await loadVersionDto(db, planId, plan.currentVersionNumber)
      // Keep an auto-generated name in sync with the new split/frequency; manual names stay.
      const wasAutoNamed = plan.name === defaultPlanName(current.splitType, current.weeklyFrequency)
      const newName = wasAutoNamed ? defaultPlanName(proposal.splitType, proposal.weeklyFrequency) : plan.name
      await db.transaction(async tx => {
        await persistVersion(tx, planId, plan.currentVersionNumber + 1, { ...proposal, name: newName }, "adjusted", sessionKeysBySequence(current))
        if (newName !== plan.name) await tx.update(trainingPlans).set({ name: newName }).where(eq(trainingPlans.id, planId))
        await tx.update(planAdjustmentPreviews).set({ appliedAt: new Date() }).where(eq(planAdjustmentPreviews.id, preview.id))
        const patch = preview.profilePatch as Partial<{ weeklyFrequency: number; sessionDurationMinutes: number }>
        if (Object.keys(patch).length) await tx.update(userTrainingProfiles).set({ ...patch, updatedAt: new Date() }).where(eq(userTrainingProfiles.userId, userId))
      })
      return loadPlanDto(db, userId, planId)
    },

    async discardPreview(userId: string, planId: string, previewId: string) {
      await db.delete(planAdjustmentPreviews).where(and(eq(planAdjustmentPreviews.id, previewId), eq(planAdjustmentPreviews.userId, userId), eq(planAdjustmentPreviews.trainingPlanId, planId)))
    },

    /**
     * This week's sessions as concrete dates, including moves/skips and linked workouts.
     * Overrides and workouts are matched by sessionKey, so they survive plan edits.
     * "Today" and the default week come from `timeZone` (default Europe/Berlin).
     */
    async week(userId: string, dateISO: string | undefined, timeZoneInput?: string): Promise<PlanWeekDto> {
      const timeZone = resolveTimeZone(timeZoneInput)
      const now = new Date()
      const todayISO = localDateISO(now, timeZone)
      const weekStart = weekStartISO(new Date(`${dateISO ?? todayISO}T12:00:00Z`), "UTC")
      const weekEnd = addDaysISO(weekStart, 6)
      const plan = await activePlan(userId)
      if (!plan) return { weekStart, weekEnd, planId: null, sessions: [], nextSessionId: null, today: todayISO, timeZone }
      const version = await loadVersionDto(db, plan.id, plan.currentVersionNumber)
      const keys = version.sessions.map(s => s.sessionKey!).filter(Boolean)
      const overrides = keys.length
        ? await db
            .select()
            .from(sessionOverrides)
            .where(and(eq(sessionOverrides.userId, userId), eq(sessionOverrides.weekStart, weekStart), inArray(sessionOverrides.sessionKey, keys)))
        : []
      // Week boundaries are local midnights in the user's zone.
      const weekWorkouts = keys.length
        ? await db
            .select()
            .from(workouts)
            .where(
              and(
                eq(workouts.userId, userId),
                ne(workouts.status, "cancelled"),
                inArray(workouts.sourceSessionKey, keys),
                sql`${workouts.startedAt} >= (${weekStart}::date::timestamp at time zone ${timeZone})`,
                sql`${workouts.startedAt} < ((${weekEnd}::date + 1)::timestamp at time zone ${timeZone})`,
              ),
            )
            .orderBy(asc(workouts.startedAt))
        : []
      const sessions = version.sessions.map(s => {
        const ov = overrides.find(o => o.sessionKey === s.sessionKey)
        // Template weekday → date within this Monday-based week.
        let date: string | null = null
        if (ov?.status === "skipped") date = null
        else if (ov?.status === "moved") date = ov.scheduledDate
        else if (s.weekday !== null) date = addDaysISO(weekStart, (s.weekday + 6) % 7)
        const linked = weekWorkouts.filter(x => x.sourceSessionKey === s.sessionKey)
        const w = linked.find(x => x.status === "completed") ?? linked[0]
        const status = w ? (w.status === "completed" ? "completed" : "in_progress") : ov?.status === "skipped" ? "skipped" : "planned"
        return {
          planSessionId: s.id,
          sessionKey: s.sessionKey,
          name: s.name,
          sequence: s.sequence,
          focusMuscles: s.focusMuscles,
          estimatedDurationMinutes: s.estimatedDurationMinutes,
          exerciseCount: s.exercises.length,
          templateWeekday: s.weekday,
          date,
          status: status as "planned" | "skipped" | "completed" | "in_progress",
          workoutId: w?.id ?? null,
        }
      })
      const open = sessions.filter(s => s.status === "planned" || s.status === "in_progress")
      const upcoming = open.filter(s => s.date && s.date >= todayISO).sort((a, b) => a.date!.localeCompare(b.date!))
      const next = sessions.find(s => s.status === "in_progress") ?? upcoming[0] ?? [...open].sort((a, b) => a.sequence - b.sequence)[0] ?? null
      return { weekStart, weekEnd, planId: plan.id, sessions, nextSessionId: next?.planSessionId ?? null, today: todayISO, timeZone }
    },

    /** Move or skip one session in one week without touching the template. */
    async overrideSession(userId: string, planSessionId: string, body: OverrideBody, timeZone?: string) {
      const [row] = await db
        .select({ s: trainingPlanSessions, p: trainingPlans })
        .from(trainingPlanSessions)
        .innerJoin(trainingPlanVersions, eq(trainingPlanVersions.id, trainingPlanSessions.trainingPlanVersionId))
        .innerJoin(trainingPlans, eq(trainingPlans.id, trainingPlanVersions.trainingPlanId))
        .where(and(eq(trainingPlanSessions.id, planSessionId), eq(trainingPlans.userId, userId)))
      if (!row) throw notFound("Plan session")
      const sessionKey = row.s.sessionKey
      if (body.action === "reset") {
        await db.delete(sessionOverrides).where(and(eq(sessionOverrides.userId, userId), eq(sessionOverrides.sessionKey, sessionKey), eq(sessionOverrides.weekStart, body.weekStart)))
      } else {
        if (body.action === "move" && !body.date) throw badRequest("date_required", "A date is required to move a session")
        const values = { userId, trainingPlanSessionId: planSessionId, sessionKey, weekStart: body.weekStart, status: body.action === "move" ? ("moved" as const) : ("skipped" as const), scheduledDate: body.action === "move" ? body.date! : null, updatedAt: new Date() }
        await db
          .insert(sessionOverrides)
          .values(values)
          .onConflictDoUpdate({ target: [sessionOverrides.userId, sessionOverrides.sessionKey, sessionOverrides.weekStart], set: { trainingPlanSessionId: planSessionId, status: values.status, scheduledDate: values.scheduledDate, updatedAt: new Date() } })
      }
      return this.week(userId, body.weekStart, timeZone)
    },

    async sessionDetail(userId: string, planSessionId: string) {
      const [row] = await db
        .select({ s: trainingPlanSessions, v: trainingPlanVersions, p: trainingPlans })
        .from(trainingPlanSessions)
        .innerJoin(trainingPlanVersions, eq(trainingPlanVersions.id, trainingPlanSessions.trainingPlanVersionId))
        .innerJoin(trainingPlans, eq(trainingPlans.id, trainingPlanVersions.trainingPlanId))
        .where(and(eq(trainingPlanSessions.id, planSessionId), eq(trainingPlans.userId, userId)))
      if (!row) throw notFound("Plan session")
      const version = await loadVersionDto(db, row.p.id, row.v.versionNumber)
      const session = version.sessions.find(s => s.id === planSessionId)
      if (!session) throw notFound("Plan session")
      return { planId: row.p.id, planName: row.p.name, versionNumber: row.v.versionNumber, session }
    },
  }
}

/**
 * Coalesce into the current version only if an edit created it moments ago and
 * nothing references it yet (no workouts, no pending adjustment preview based on it).
 */
async function canCoalesceEdit(tx: DbOrTx, planId: string, versionId: string, versionNumber: number): Promise<boolean> {
  const [v] = await tx.select().from(trainingPlanVersions).where(eq(trainingPlanVersions.id, versionId))
  if (!v || v.changeReason !== "edited" || Date.now() - v.createdAt.getTime() > EDIT_COALESCE_WINDOW_MS) return false
  const [w] = await tx
    .select({ id: workouts.id })
    .from(workouts)
    .where(or(eq(workouts.trainingPlanVersionId, versionId), inArray(workouts.sourceSessionId, tx.select({ id: trainingPlanSessions.id }).from(trainingPlanSessions).where(eq(trainingPlanSessions.trainingPlanVersionId, versionId)))))
    .limit(1)
  if (w) return false
  const [p] = await tx
    .select({ id: planAdjustmentPreviews.id })
    .from(planAdjustmentPreviews)
    .where(and(eq(planAdjustmentPreviews.trainingPlanId, planId), eq(planAdjustmentPreviews.baseVersionNumber, versionNumber), isNull(planAdjustmentPreviews.appliedAt), gt(planAdjustmentPreviews.expiresAt, new Date())))
    .limit(1)
  return !p
}

function proposalDto(p: PlanDraft, refs: { id: string; nameDe: string }[]): AdjustmentPreviewDto["proposal"] {
  const nameById = new Map(refs.map(r => [r.id, r.nameDe]))
  return {
    splitType: p.splitType,
    weeklyFrequency: p.weeklyFrequency,
    weeklySets: p.weeklySets,
    rationale: p.rationale,
    sessions: p.sessions.map(s => ({
      name: s.name,
      sequence: s.sequence,
      weekday: s.weekday,
      focusMuscles: s.focusMuscles,
      estimatedDurationMinutes: s.estimatedDurationMinutes,
      exercises: s.exercises.map(e => ({ ...e, exerciseName: nameById.get(e.exerciseId) ?? "Unbekannte Übung" })),
    })),
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

export type PlanDiffDto = PlanDiff
export { trainingPlanExercises }
