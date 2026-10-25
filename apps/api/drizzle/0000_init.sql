CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."training_environment" AS ENUM('full_gym', 'limited_gym', 'home', 'custom');--> statement-breakpoint
CREATE TYPE "public"."equipment" AS ENUM('barbell', 'dumbbell', 'cable', 'machine', 'smith_machine', 'bodyweight', 'kettlebell', 'ez_bar', 'trap_bar', 'bench', 'pull_up_bar', 'dip_station', 'resistance_band', 'ab_wheel', 'plate', 'cardio_machine');--> statement-breakpoint
CREATE TYPE "public"."exercise_category" AS ENUM('compound', 'isolation', 'core', 'cardio', 'mobility', 'warmup');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."goal" AS ENUM('hypertrophy', 'strength', 'general_fitness', 'return_to_training', 'muscle_focus');--> statement-breakpoint
CREATE TYPE "public"."load_type" AS ENUM('machine', 'cable', 'free_weight', 'bodyweight');--> statement-breakpoint
CREATE TYPE "public"."movement_pattern" AS ENUM('horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'squat', 'hinge', 'lunge', 'elbow_flexion', 'elbow_extension', 'shoulder_abduction', 'shoulder_flexion', 'shoulder_horizontal_abduction', 'shoulder_horizontal_adduction', 'hip_abduction', 'hip_adduction', 'hip_extension', 'knee_extension', 'knee_flexion', 'plantar_flexion', 'trunk_flexion', 'anti_rotation', 'anti_extension', 'lateral_flexion', 'spinal_extension', 'carry', 'grip', 'wrist_flexion', 'wrist_extension', 'locomotion', 'mobility');--> statement-breakpoint
CREATE TYPE "public"."muscle_role" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TYPE "public"."muscle_slug" AS ENUM('chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'lower_back');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."preference_type" AS ENUM('preferred', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."record_type" AS ENUM('max_weight', 'max_reps_at_weight', 'max_set_volume', 'max_session_volume', 'estimated_1rm');--> statement-breakpoint
CREATE TYPE "public"."session_override_status" AS ENUM('moved', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."set_type" AS ENUM('warmup', 'working', 'drop', 'superset', 'failure', 'backoff');--> statement-breakpoint
CREATE TYPE "public"."split_type" AS ENUM('full_body', 'upper_lower', 'push_pull_legs', 'custom');--> statement-breakpoint
CREATE TYPE "public"."weight_unit" AS ENUM('kg', 'lb');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('in_progress', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "exercise_alternatives" (
	"exercise_id" uuid NOT NULL,
	"alternative_exercise_id" uuid NOT NULL,
	CONSTRAINT "exercise_alternatives_exercise_id_alternative_exercise_id_pk" PRIMARY KEY("exercise_id","alternative_exercise_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_bests" (
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"max_weight_grams" integer DEFAULT 0 NOT NULL,
	"reps_at_weight" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_set_volume_grams" bigint DEFAULT 0 NOT NULL,
	"max_session_volume_grams" bigint DEFAULT 0 NOT NULL,
	"estimated_1rm_grams" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_bests_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_muscles" (
	"exercise_id" uuid NOT NULL,
	"muscle_group_id" uuid NOT NULL,
	"role" "muscle_role" NOT NULL,
	CONSTRAINT "exercise_muscles_exercise_id_muscle_group_id_pk" PRIMARY KEY("exercise_id","muscle_group_id")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_de" text NOT NULL,
	"name_en" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"category" "exercise_category" NOT NULL,
	"movement_pattern" "movement_pattern" NOT NULL,
	"equipment" "equipment"[] NOT NULL,
	"load_type" "load_type" NOT NULL,
	"difficulty" "difficulty" DEFAULT 'beginner' NOT NULL,
	"is_unilateral" boolean DEFAULT false NOT NULL,
	"description" text,
	"cues" text[] DEFAULT '{}'::text[] NOT NULL,
	"common_mistakes" text[] DEFAULT '{}'::text[] NOT NULL,
	"set_seconds" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"owner_user_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "muscle_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "muscle_slug" NOT NULL,
	"name_de" text NOT NULL,
	"name_en" text NOT NULL,
	"region" text NOT NULL,
	"display_order" integer NOT NULL,
	CONSTRAINT "muscle_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "personal_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid,
	"exercise_name_snapshot" text NOT NULL,
	"type" "record_type" NOT NULL,
	"value_grams" bigint,
	"reps" integer,
	"weight_grams" integer,
	"workout_id" uuid,
	"achieved_at" timestamp with time zone NOT NULL,
	"is_estimate" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_adjustment_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"training_plan_id" uuid NOT NULL,
	"base_version_number" integer NOT NULL,
	"proposal" jsonb NOT NULL,
	"diff" jsonb NOT NULL,
	"profile_patch" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"training_plan_session_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"status" "session_override_status" NOT NULL,
	"scheduled_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_plan_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_plan_session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"target_sets" integer NOT NULL,
	"target_reps_min" integer NOT NULL,
	"target_reps_max" integer NOT NULL,
	"rest_seconds" integer NOT NULL,
	"target_rir" integer,
	"warmup_sets" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "training_plan_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_plan_version_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sequence" integer NOT NULL,
	"weekday" smallint,
	"focus_muscles" "muscle_slug"[] DEFAULT '{}'::muscle_slug[] NOT NULL,
	"estimated_duration_minutes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"training_plan_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"split_type" "split_type" NOT NULL,
	"weekly_frequency" integer NOT NULL,
	"weekly_sets" jsonb NOT NULL,
	"rationale" jsonb NOT NULL,
	"change_reason" text DEFAULT 'generated' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "plan_status" DEFAULT 'draft' NOT NULL,
	"current_version_number" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_exercise_favorites" (
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_exercise_favorites_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "user_exercise_preferences" (
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"preference_type" "preference_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_exercise_preferences_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "user_muscle_priorities" (
	"user_id" uuid NOT NULL,
	"muscle_group_id" uuid NOT NULL,
	"priority" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_muscle_priorities_user_id_muscle_group_id_pk" PRIMARY KEY("user_id","muscle_group_id")
);
--> statement-breakpoint
CREATE TABLE "user_training_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"primary_goal" "goal" DEFAULT 'hypertrophy' NOT NULL,
	"secondary_goals" "goal"[] DEFAULT '{}'::goal[] NOT NULL,
	"experience_level" "experience_level" DEFAULT 'beginner' NOT NULL,
	"session_duration_minutes" integer DEFAULT 60 NOT NULL,
	"weekly_frequency" integer DEFAULT 3 NOT NULL,
	"environment" "training_environment" DEFAULT 'full_gym' NOT NULL,
	"available_equipment" "equipment"[] DEFAULT '{}'::equipment[] NOT NULL,
	"preferred_weekdays" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"weight_unit" "weight_unit" DEFAULT 'kg' NOT NULL,
	"locale" text DEFAULT 'de' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"client_id" text,
	"exercise_id" uuid,
	"exercise_name_snapshot" text NOT NULL,
	"sequence" integer NOT NULL,
	"target_sets" integer,
	"target_reps_min" integer,
	"target_reps_max" integer,
	"rest_seconds" integer,
	"target_rir" integer,
	"skipped" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_exercise_id" uuid NOT NULL,
	"client_id" text,
	"set_number" integer NOT NULL,
	"set_type" "set_type" DEFAULT 'working' NOT NULL,
	"weight_grams" integer,
	"reps" integer,
	"rir" integer,
	"rpe" numeric(3, 1),
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"target_weight_grams" integer,
	"target_reps" integer,
	"client_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" text,
	"name" text NOT NULL,
	"status" "workout_status" DEFAULT 'in_progress' NOT NULL,
	"training_plan_id" uuid,
	"training_plan_version_id" uuid,
	"source_session_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"paused_seconds" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_alternative_exercise_id_exercises_id_fk" FOREIGN KEY ("alternative_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_bests" ADD CONSTRAINT "exercise_bests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_bests" ADD CONSTRAINT "exercise_bests_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_muscle_group_id_muscle_groups_id_fk" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_adjustment_previews" ADD CONSTRAINT "plan_adjustment_previews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_adjustment_previews" ADD CONSTRAINT "plan_adjustment_previews_training_plan_id_training_plans_id_fk" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_overrides" ADD CONSTRAINT "session_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_overrides" ADD CONSTRAINT "session_overrides_training_plan_session_id_training_plan_sessions_id_fk" FOREIGN KEY ("training_plan_session_id") REFERENCES "public"."training_plan_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_exercises" ADD CONSTRAINT "training_plan_exercises_training_plan_session_id_training_plan_sessions_id_fk" FOREIGN KEY ("training_plan_session_id") REFERENCES "public"."training_plan_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_exercises" ADD CONSTRAINT "training_plan_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_sessions" ADD CONSTRAINT "training_plan_sessions_training_plan_version_id_training_plan_versions_id_fk" FOREIGN KEY ("training_plan_version_id") REFERENCES "public"."training_plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plan_versions" ADD CONSTRAINT "training_plan_versions_training_plan_id_training_plans_id_fk" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exercise_favorites" ADD CONSTRAINT "user_exercise_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exercise_favorites" ADD CONSTRAINT "user_exercise_favorites_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exercise_preferences" ADD CONSTRAINT "user_exercise_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exercise_preferences" ADD CONSTRAINT "user_exercise_preferences_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_muscle_priorities" ADD CONSTRAINT "user_muscle_priorities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_muscle_priorities" ADD CONSTRAINT "user_muscle_priorities_muscle_group_id_muscle_groups_id_fk" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_training_profiles" ADD CONSTRAINT "user_training_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_id_workout_exercises_id_fk" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_training_plan_id_training_plans_id_fk" FOREIGN KEY ("training_plan_id") REFERENCES "public"."training_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_training_plan_version_id_training_plan_versions_id_fk" FOREIGN KEY ("training_plan_version_id") REFERENCES "public"."training_plan_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_source_session_id_training_plan_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."training_plan_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_muscles_muscle_idx" ON "exercise_muscles" USING btree ("muscle_group_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_slug_idx" ON "exercises" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "exercises_owner_idx" ON "exercises" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "exercises_name_de_idx" ON "exercises" USING btree (lower("name_de"));--> statement-breakpoint
CREATE INDEX "idempotency_created_idx" ON "idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "personal_records_user_exercise_idx" ON "personal_records" USING btree ("user_id","exercise_id");--> statement-breakpoint
CREATE INDEX "personal_records_user_achieved_idx" ON "personal_records" USING btree ("user_id","achieved_at");--> statement-breakpoint
CREATE INDEX "plan_previews_user_idx" ON "plan_adjustment_previews" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_overrides_unique_idx" ON "session_overrides" USING btree ("training_plan_session_id","week_start");--> statement-breakpoint
CREATE INDEX "session_overrides_user_week_idx" ON "session_overrides" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "plan_exercises_session_idx" ON "training_plan_exercises" USING btree ("training_plan_session_id");--> statement-breakpoint
CREATE INDEX "plan_sessions_version_idx" ON "training_plan_sessions" USING btree ("training_plan_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_versions_plan_version_idx" ON "training_plan_versions" USING btree ("training_plan_id","version_number");--> statement-breakpoint
CREATE INDEX "training_plans_user_idx" ON "training_plans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_plans_one_active_idx" ON "training_plans" USING btree ("user_id") WHERE "training_plans"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "workout_exercises_client_idx" ON "workout_exercises" USING btree ("workout_id","client_id");--> statement-breakpoint
CREATE INDEX "workout_exercises_exercise_idx" ON "workout_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_sets_client_idx" ON "workout_sets" USING btree ("workout_exercise_id","client_id");--> statement-breakpoint
CREATE INDEX "workout_sets_exercise_idx" ON "workout_sets" USING btree ("workout_exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_user_client_idx" ON "workouts" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "workouts_user_started_idx" ON "workouts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "workouts_user_status_idx" ON "workouts" USING btree ("user_id","status");