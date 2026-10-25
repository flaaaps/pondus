import { relations, sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import {
  DIFFICULTIES,
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  EXPERIENCE_LEVELS,
  GOALS,
  LOAD_TYPES,
  MOVEMENT_PATTERNS,
  MUSCLE_SLUGS,
  PREFERENCE_TYPES,
  RECORD_TYPES,
  SET_TYPES,
  SPLIT_TYPES,
  TRAINING_ENVIRONMENTS,
} from "@pondus/shared"

const tuple = <T extends readonly string[]>(v: T) => v as unknown as [T[number], ...T[number][]]

export const goalEnum = pgEnum("goal", tuple(GOALS))
export const experienceLevelEnum = pgEnum("experience_level", tuple(EXPERIENCE_LEVELS))
export const environmentEnum = pgEnum("training_environment", tuple(TRAINING_ENVIRONMENTS))
export const equipmentEnum = pgEnum("equipment", tuple(EQUIPMENT))
export const exerciseCategoryEnum = pgEnum("exercise_category", tuple(EXERCISE_CATEGORIES))
export const movementPatternEnum = pgEnum("movement_pattern", tuple(MOVEMENT_PATTERNS))
export const difficultyEnum = pgEnum("difficulty", tuple(DIFFICULTIES))
export const loadTypeEnum = pgEnum("load_type", tuple(LOAD_TYPES))
export const muscleSlugEnum = pgEnum("muscle_slug", tuple(MUSCLE_SLUGS))
export const muscleRoleEnum = pgEnum("muscle_role", ["primary", "secondary"])
export const preferenceTypeEnum = pgEnum("preference_type", tuple(PREFERENCE_TYPES))
export const splitTypeEnum = pgEnum("split_type", tuple(SPLIT_TYPES))
export const planStatusEnum = pgEnum("plan_status", ["draft", "active", "archived"])
export const workoutStatusEnum = pgEnum("workout_status", ["in_progress", "paused", "completed", "cancelled"])
export const setTypeEnum = pgEnum("set_type", tuple(SET_TYPES))
export const recordTypeEnum = pgEnum("record_type", tuple(RECORD_TYPES))
export const weightUnitEnum = pgEnum("weight_unit", ["kg", "lb"])
export const sessionOverrideStatusEnum = pgEnum("session_override_status", ["moved", "skipped"])

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}
const id = uuid("id").primaryKey().default(sql`gen_random_uuid()`)

export const users = pgTable(
  "users",
  {
    id,
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    weightUnit: weightUnitEnum("weight_unit").notNull().default("kg"),
    locale: text("locale").notNull().default("de"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  t => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)],
)

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id,
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex("refresh_tokens_hash_idx").on(t.tokenHash), index("refresh_tokens_user_idx").on(t.userId)],
)

export const userTrainingProfiles = pgTable("user_training_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  primaryGoal: goalEnum("primary_goal").notNull().default("hypertrophy"),
  secondaryGoals: goalEnum("secondary_goals").array().notNull().default(sql`'{}'::goal[]`),
  experienceLevel: experienceLevelEnum("experience_level").notNull().default("beginner"),
  sessionDurationMinutes: integer("session_duration_minutes").notNull().default(60),
  weeklyFrequency: integer("weekly_frequency").notNull().default(3),
  environment: environmentEnum("environment").notNull().default("full_gym"),
  availableEquipment: equipmentEnum("available_equipment").array().notNull().default(sql`'{}'::equipment[]`),
  preferredWeekdays: smallint("preferred_weekdays").array().notNull().default(sql`'{}'::smallint[]`),
  ...timestamps,
})

export const muscleGroups = pgTable("muscle_groups", {
  id,
  slug: muscleSlugEnum("slug").notNull().unique(),
  nameDe: text("name_de").notNull(),
  nameEn: text("name_en").notNull(),
  region: text("region").notNull(),
  displayOrder: integer("display_order").notNull(),
})

export const exercises = pgTable(
  "exercises",
  {
    id,
    slug: text("slug").notNull(),
    nameDe: text("name_de").notNull(),
    nameEn: text("name_en").notNull(),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    category: exerciseCategoryEnum("category").notNull(),
    movementPattern: movementPatternEnum("movement_pattern").notNull(),
    equipment: equipmentEnum("equipment").array().notNull(),
    loadType: loadTypeEnum("load_type").notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("beginner"),
    isUnilateral: boolean("is_unilateral").notNull().default(false),
    description: text("description"),
    cues: text("cues").array().notNull().default(sql`'{}'::text[]`),
    commonMistakes: text("common_mistakes").array().notNull().default(sql`'{}'::text[]`),
    setSeconds: integer("set_seconds"),
    isSystem: boolean("is_system").notNull().default(false),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  t => [
    uniqueIndex("exercises_slug_idx").on(t.slug),
    index("exercises_owner_idx").on(t.ownerUserId),
    index("exercises_name_de_idx").on(sql`lower(${t.nameDe})`),
  ],
)

export const exerciseMuscles = pgTable(
  "exercise_muscles",
  {
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    muscleGroupId: uuid("muscle_group_id").notNull().references(() => muscleGroups.id, { onDelete: "restrict" }),
    role: muscleRoleEnum("role").notNull(),
  },
  t => [primaryKey({ columns: [t.exerciseId, t.muscleGroupId] }), index("exercise_muscles_muscle_idx").on(t.muscleGroupId, t.role)],
)

export const exerciseAlternatives = pgTable(
  "exercise_alternatives",
  {
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    alternativeExerciseId: uuid("alternative_exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  },
  t => [primaryKey({ columns: [t.exerciseId, t.alternativeExerciseId] })],
)

export const userExercisePreferences = pgTable(
  "user_exercise_preferences",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    preferenceType: preferenceTypeEnum("preference_type").notNull(),
    ...timestamps,
  },
  t => [primaryKey({ columns: [t.userId, t.exerciseId] })],
)

export const userExerciseFavorites = pgTable(
  "user_exercise_favorites",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  t => [primaryKey({ columns: [t.userId, t.exerciseId] })],
)

export const userMusclePriorities = pgTable(
  "user_muscle_priorities",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    muscleGroupId: uuid("muscle_group_id").notNull().references(() => muscleGroups.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull(),
    ...timestamps,
  },
  t => [primaryKey({ columns: [t.userId, t.muscleGroupId] })],
)

export const trainingPlans = pgTable(
  "training_plans",
  {
    id,
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: planStatusEnum("status").notNull().default("draft"),
    currentVersionNumber: integer("current_version_number").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  t => [
    index("training_plans_user_idx").on(t.userId),
    // Only one active plan per user.
    uniqueIndex("training_plans_one_active_idx").on(t.userId).where(sql`${t.status} = 'active'`),
  ],
)

export const trainingPlanVersions = pgTable(
  "training_plan_versions",
  {
    id,
    trainingPlanId: uuid("training_plan_id").notNull().references(() => trainingPlans.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    splitType: splitTypeEnum("split_type").notNull(),
    weeklyFrequency: integer("weekly_frequency").notNull(),
    weeklySets: jsonb("weekly_sets").$type<Record<string, number>>().notNull(),
    rationale: jsonb("rationale").$type<{ key: string; title: string; body: string }[]>().notNull(),
    /** Why this version exists: generated | edited | adjusted */
    changeReason: text("change_reason").notNull().default("generated"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex("plan_versions_plan_version_idx").on(t.trainingPlanId, t.versionNumber)],
)

export const trainingPlanSessions = pgTable(
  "training_plan_sessions",
  {
    id,
    trainingPlanVersionId: uuid("training_plan_version_id").notNull().references(() => trainingPlanVersions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sequence: integer("sequence").notNull(),
    weekday: smallint("weekday"),
    focusMuscles: muscleSlugEnum("focus_muscles").array().notNull().default(sql`'{}'::muscle_slug[]`),
    estimatedDurationMinutes: integer("estimated_duration_minutes").notNull().default(0),
  },
  t => [index("plan_sessions_version_idx").on(t.trainingPlanVersionId)],
)

export const trainingPlanExercises = pgTable(
  "training_plan_exercises",
  {
    id,
    trainingPlanSessionId: uuid("training_plan_session_id").notNull().references(() => trainingPlanSessions.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    targetSets: integer("target_sets").notNull(),
    targetRepsMin: integer("target_reps_min").notNull(),
    targetRepsMax: integer("target_reps_max").notNull(),
    restSeconds: integer("rest_seconds").notNull(),
    targetRir: integer("target_rir"),
    warmupSets: integer("warmup_sets").notNull().default(0),
    notes: text("notes"),
  },
  t => [index("plan_exercises_session_idx").on(t.trainingPlanSessionId)],
)

/** Per-week calendar overrides: move a session to another date or skip it this week, without changing the template. */
export const sessionOverrides = pgTable(
  "session_overrides",
  {
    id,
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    trainingPlanSessionId: uuid("training_plan_session_id").notNull().references(() => trainingPlanSessions.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    status: sessionOverrideStatusEnum("status").notNull(),
    scheduledDate: date("scheduled_date"),
    ...timestamps,
  },
  t => [uniqueIndex("session_overrides_unique_idx").on(t.trainingPlanSessionId, t.weekStart), index("session_overrides_user_week_idx").on(t.userId, t.weekStart)],
)

export const planAdjustmentPreviews = pgTable(
  "plan_adjustment_previews",
  {
    id,
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    trainingPlanId: uuid("training_plan_id").notNull().references(() => trainingPlans.id, { onDelete: "cascade" }),
    baseVersionNumber: integer("base_version_number").notNull(),
    proposal: jsonb("proposal").notNull(),
    diff: jsonb("diff").notNull(),
    profilePatch: jsonb("profile_patch").$type<Record<string, unknown>>().notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index("plan_previews_user_idx").on(t.userId)],
)

export const workouts = pgTable(
  "workouts",
  {
    id,
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id"),
    name: text("name").notNull(),
    status: workoutStatusEnum("status").notNull().default("in_progress"),
    trainingPlanId: uuid("training_plan_id").references(() => trainingPlans.id, { onDelete: "set null" }),
    trainingPlanVersionId: uuid("training_plan_version_id").references(() => trainingPlanVersions.id, { onDelete: "set null" }),
    sourceSessionId: uuid("source_session_id").references(() => trainingPlanSessions.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pausedSeconds: integer("paused_seconds").notNull().default(0),
    durationSeconds: integer("duration_seconds"),
    notes: text("notes"),
    ...timestamps,
  },
  t => [
    uniqueIndex("workouts_user_client_idx").on(t.userId, t.clientId),
    index("workouts_user_started_idx").on(t.userId, t.startedAt),
    index("workouts_user_status_idx").on(t.userId, t.status),
  ],
)

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id,
    workoutId: uuid("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
    clientId: text("client_id"),
    exerciseId: uuid("exercise_id").references(() => exercises.id, { onDelete: "set null" }),
    exerciseNameSnapshot: text("exercise_name_snapshot").notNull(),
    sequence: integer("sequence").notNull(),
    targetSets: integer("target_sets"),
    targetRepsMin: integer("target_reps_min"),
    targetRepsMax: integer("target_reps_max"),
    restSeconds: integer("rest_seconds"),
    targetRir: integer("target_rir"),
    skipped: boolean("skipped").notNull().default(false),
    notes: text("notes"),
    ...timestamps,
  },
  t => [uniqueIndex("workout_exercises_client_idx").on(t.workoutId, t.clientId), index("workout_exercises_exercise_idx").on(t.exerciseId)],
)

export const workoutSets = pgTable(
  "workout_sets",
  {
    id,
    workoutExerciseId: uuid("workout_exercise_id").notNull().references(() => workoutExercises.id, { onDelete: "cascade" }),
    clientId: text("client_id"),
    setNumber: integer("set_number").notNull(),
    setType: setTypeEnum("set_type").notNull().default("working"),
    weightGrams: integer("weight_grams"),
    reps: integer("reps"),
    rir: integer("rir"),
    rpe: numeric("rpe", { precision: 3, scale: 1 }),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    targetWeightGrams: integer("target_weight_grams"),
    targetReps: integer("target_reps"),
    clientUpdatedAt: timestamp("client_updated_at", { withTimezone: true }),
    ...timestamps,
  },
  t => [uniqueIndex("workout_sets_client_idx").on(t.workoutExerciseId, t.clientId), index("workout_sets_exercise_idx").on(t.workoutExerciseId)],
)

export const personalRecords = pgTable(
  "personal_records",
  {
    id,
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").references(() => exercises.id, { onDelete: "set null" }),
    exerciseNameSnapshot: text("exercise_name_snapshot").notNull(),
    type: recordTypeEnum("type").notNull(),
    valueGrams: bigint("value_grams", { mode: "number" }),
    reps: integer("reps"),
    weightGrams: integer("weight_grams"),
    workoutId: uuid("workout_id").references(() => workouts.id, { onDelete: "set null" }),
    achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull(),
    isEstimate: boolean("is_estimate").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index("personal_records_user_exercise_idx").on(t.userId, t.exerciseId), index("personal_records_user_achieved_idx").on(t.userId, t.achievedAt)],
)

export const exerciseBests = pgTable(
  "exercise_bests",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
    maxWeightGrams: integer("max_weight_grams").notNull().default(0),
    repsAtWeight: jsonb("reps_at_weight").$type<Record<number, number>>().notNull().default({}),
    maxSetVolumeGrams: bigint("max_set_volume_grams", { mode: "number" }).notNull().default(0),
    maxSessionVolumeGrams: bigint("max_session_volume_grams", { mode: "number" }).notNull().default(0),
    estimated1rmGrams: integer("estimated_1rm_grams").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  t => [primaryKey({ columns: [t.userId, t.exerciseId] })],
)

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  t => [primaryKey({ columns: [t.userId, t.key] }), index("idempotency_created_idx").on(t.createdAt)],
)

// Relations (for the relational query API)
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userTrainingProfiles, { fields: [users.id], references: [userTrainingProfiles.userId] }),
  plans: many(trainingPlans),
  workouts: many(workouts),
}))
export const exercisesRelations = relations(exercises, ({ many }) => ({ muscles: many(exerciseMuscles) }))
export const exerciseMusclesRelations = relations(exerciseMuscles, ({ one }) => ({
  exercise: one(exercises, { fields: [exerciseMuscles.exerciseId], references: [exercises.id] }),
  muscleGroup: one(muscleGroups, { fields: [exerciseMuscles.muscleGroupId], references: [muscleGroups.id] }),
}))
export const trainingPlansRelations = relations(trainingPlans, ({ many }) => ({ versions: many(trainingPlanVersions) }))
export const trainingPlanVersionsRelations = relations(trainingPlanVersions, ({ one, many }) => ({
  plan: one(trainingPlans, { fields: [trainingPlanVersions.trainingPlanId], references: [trainingPlans.id] }),
  sessions: many(trainingPlanSessions),
}))
export const trainingPlanSessionsRelations = relations(trainingPlanSessions, ({ one, many }) => ({
  version: one(trainingPlanVersions, { fields: [trainingPlanSessions.trainingPlanVersionId], references: [trainingPlanVersions.id] }),
  exercises: many(trainingPlanExercises),
}))
export const trainingPlanExercisesRelations = relations(trainingPlanExercises, ({ one }) => ({
  session: one(trainingPlanSessions, { fields: [trainingPlanExercises.trainingPlanSessionId], references: [trainingPlanSessions.id] }),
  exercise: one(exercises, { fields: [trainingPlanExercises.exerciseId], references: [exercises.id] }),
}))
export const workoutsRelations = relations(workouts, ({ many }) => ({ exercises: many(workoutExercises) }))
export const workoutExercisesRelations = relations(workoutExercises, ({ one, many }) => ({
  workout: one(workouts, { fields: [workoutExercises.workoutId], references: [workouts.id] }),
  sets: many(workoutSets),
}))
export const workoutSetsRelations = relations(workoutSets, ({ one }) => ({
  workoutExercise: one(workoutExercises, { fields: [workoutSets.workoutExerciseId], references: [workoutExercises.id] }),
}))
