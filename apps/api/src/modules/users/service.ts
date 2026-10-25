import { and, eq, inArray, sql } from "drizzle-orm"
import type { ExercisePreferencesDto, TrainingProfileDto, UpdateTrainingProfileBody } from "./types.js"
import type { Db, DbOrTx } from "../../db/client.js"
import {
  exercises,
  muscleGroups,
  personalRecords,
  refreshTokens,
  trainingPlans,
  userExercisePreferences,
  userMusclePriorities,
  userTrainingProfiles,
  users,
  workouts,
} from "../../db/schema.js"
import { badRequest, notFound } from "../../shared/errors.js"
import { ENVIRONMENT_EQUIPMENT, isMuscleSlug, type MuscleSlug, type TrainingProfile } from "@pondus/shared"
import { toUserDto } from "../auth/service.js"

export async function loadTrainingProfile(db: DbOrTx, userId: string): Promise<TrainingProfile> {
  const [p] = await db.select().from(userTrainingProfiles).where(eq(userTrainingProfiles.userId, userId))
  if (!p) throw notFound("Training profile")
  const prios = await db
    .select({ slug: muscleGroups.slug, priority: userMusclePriorities.priority })
    .from(userMusclePriorities)
    .innerJoin(muscleGroups, eq(muscleGroups.id, userMusclePriorities.muscleGroupId))
    .where(eq(userMusclePriorities.userId, userId))
  const prefs = await db.select().from(userExercisePreferences).where(eq(userExercisePreferences.userId, userId))
  const equipment = p.environment === "custom" || p.availableEquipment.length ? p.availableEquipment : ENVIRONMENT_EQUIPMENT[p.environment]
  return {
    primaryGoal: p.primaryGoal,
    secondaryGoals: p.secondaryGoals,
    experienceLevel: p.experienceLevel,
    sessionDurationMinutes: p.sessionDurationMinutes,
    weeklyFrequency: p.weeklyFrequency,
    environment: p.environment,
    availableEquipment: equipment,
    musclePriorities: prios.map(x => ({ muscle: x.slug, priority: x.priority })).sort((a, b) => a.priority - b.priority),
    preferredExerciseIds: prefs.filter(x => x.preferenceType === "preferred").map(x => x.exerciseId),
    excludedExerciseIds: prefs.filter(x => x.preferenceType === "excluded").map(x => x.exerciseId),
    preferredWeekdays: p.preferredWeekdays,
  }
}

export function createUsersService(db: Db) {
  async function profileDto(userId: string): Promise<TrainingProfileDto> {
    const [p] = await db.select().from(userTrainingProfiles).where(eq(userTrainingProfiles.userId, userId))
    if (!p) throw notFound("Training profile")
    const full = await loadTrainingProfile(db, userId)
    return {
      primaryGoal: p.primaryGoal,
      secondaryGoals: p.secondaryGoals,
      experienceLevel: p.experienceLevel,
      sessionDurationMinutes: p.sessionDurationMinutes,
      weeklyFrequency: p.weeklyFrequency,
      environment: p.environment,
      availableEquipment: p.availableEquipment,
      preferredWeekdays: p.preferredWeekdays,
      musclePriorities: full.musclePriorities,
      updatedAt: p.updatedAt.toISOString(),
    }
  }

  return {
    getProfile: profileDto,

    async updateProfile(userId: string, body: UpdateTrainingProfileBody) {
      await db.transaction(async tx => {
        const { musclePriorities, ...rest } = body
        const patch: Partial<typeof userTrainingProfiles.$inferInsert> = { ...rest, updatedAt: new Date() }
        if (rest.environment && rest.environment !== "custom" && !rest.availableEquipment) {
          patch.availableEquipment = ENVIRONMENT_EQUIPMENT[rest.environment]
        }
        await tx.update(userTrainingProfiles).set(patch).where(eq(userTrainingProfiles.userId, userId))
        if (musclePriorities) await replacePriorities(tx, userId, musclePriorities)
      })
      return profileDto(userId)
    },

    async updatePriorities(userId: string, priorities: { muscle: string; priority: number }[]) {
      await db.transaction(tx => replacePriorities(tx, userId, priorities))
      return profileDto(userId)
    },

    async getExercisePreferences(userId: string): Promise<ExercisePreferencesDto> {
      const rows = await db.select().from(userExercisePreferences).where(eq(userExercisePreferences.userId, userId))
      return { preferred: rows.filter(r => r.preferenceType === "preferred").map(r => r.exerciseId), excluded: rows.filter(r => r.preferenceType === "excluded").map(r => r.exerciseId) }
    },

    async updateExercisePreferences(userId: string, body: { preferred: string[]; excluded: string[] }) {
      const overlap = body.preferred.filter(id => body.excluded.includes(id))
      if (overlap.length) throw badRequest("preference_conflict", "An exercise cannot be preferred and excluded at the same time", { ids: overlap })
      const all = [...new Set([...body.preferred, ...body.excluded])]
      if (all.length) {
        const visible = await db
          .select({ id: exercises.id })
          .from(exercises)
          .where(and(inArray(exercises.id, all), sql`(${exercises.isSystem} = true or ${exercises.ownerUserId} = ${userId})`))
        if (visible.length !== all.length) throw badRequest("unknown_exercise", "One or more exercises do not exist")
      }
      await db.transaction(async tx => {
        await tx.delete(userExercisePreferences).where(eq(userExercisePreferences.userId, userId))
        const rows = [
          ...body.preferred.map(exerciseId => ({ userId, exerciseId, preferenceType: "preferred" as const })),
          ...body.excluded.map(exerciseId => ({ userId, exerciseId, preferenceType: "excluded" as const })),
        ]
        if (rows.length) await tx.insert(userExercisePreferences).values(rows)
      })
      return this.getExercisePreferences(userId)
    },

    async updateUser(userId: string, body: { displayName?: string; weightUnit?: "kg" | "lb"; locale?: string; onboardingCompleted?: boolean }) {
      const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
      if (body.displayName !== undefined) patch.displayName = body.displayName
      if (body.weightUnit !== undefined) patch.weightUnit = body.weightUnit
      if (body.locale !== undefined) patch.locale = body.locale
      if (body.onboardingCompleted !== undefined) patch.onboardingCompletedAt = body.onboardingCompleted ? new Date() : null
      const [u] = await db.update(users).set(patch).where(eq(users.id, userId)).returning()
      if (!u) throw notFound("User")
      return toUserDto(u)
    },

    /** GDPR-style export: everything the user owns, as one JSON document. */
    async exportData(userId: string) {
      const [user] = await db.select().from(users).where(eq(users.id, userId))
      if (!user) throw notFound("User")
      const profile = await loadTrainingProfile(db, userId)
      const plans = await db.query.trainingPlans.findMany({
        where: eq(trainingPlans.userId, userId),
        with: { versions: { with: { sessions: { with: { exercises: true } } } } },
      })
      const history = await db.query.workouts.findMany({ where: eq(workouts.userId, userId), with: { exercises: { with: { sets: true } } } })
      const records = await db.select().from(personalRecords).where(eq(personalRecords.userId, userId))
      const custom = await db.select().from(exercises).where(eq(exercises.ownerUserId, userId))
      const { passwordHash: _omit, ...safeUser } = user
      void _omit
      return { exportedAt: new Date().toISOString(), user: safeUser, profile, plans, workouts: history, personalRecords: records, customExercises: custom }
    },

    /** Hard delete: cascades remove every user-owned row. */
    async deleteAccount(userId: string) {
      await db.transaction(async tx => {
        await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
        await tx.delete(users).where(eq(users.id, userId))
      })
    },
  }
}

async function replacePriorities(tx: DbOrTx, userId: string, priorities: { muscle: string; priority: number }[]) {
  const slugs = priorities.map(p => p.muscle)
  if (new Set(slugs).size !== slugs.length) throw badRequest("duplicate_priority", "Each muscle may appear once")
  for (const s of slugs) if (!isMuscleSlug(s)) throw badRequest("unknown_muscle", `Unknown muscle ${s}`)
  const groups = slugs.length ? await tx.select().from(muscleGroups).where(inArray(muscleGroups.slug, slugs as MuscleSlug[])) : []
  const idBySlug = new Map(groups.map(g => [g.slug, g.id] as const))
  await tx.delete(userMusclePriorities).where(eq(userMusclePriorities.userId, userId))
  const rows = priorities
    .map((p, i) => ({ userId, muscleGroupId: idBySlug.get(p.muscle as MuscleSlug)!, priority: p.priority || i + 1 }))
    .filter(r => r.muscleGroupId)
  if (rows.length) await tx.insert(userMusclePriorities).values(rows)
}
