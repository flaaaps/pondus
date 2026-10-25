-- Assisted exercises (assisted pull-up/dip): the logged weight is assistance, not load.
-- Drizzle runs all pending migrations in ONE transaction. ADD VALUE inside a
-- transaction is fine on PostgreSQL >= 12, but the new value must not be used
-- in the same transaction, so nothing below references 'assisted'. The seed
-- (separate process after migrate) switches the library exercises to it.
ALTER TYPE "public"."load_type" ADD VALUE IF NOT EXISTS 'assisted';--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN IF NOT EXISTS "next_target" jsonb;--> statement-breakpoint
-- Bests of assisted exercises were accumulated with assistance as load (wrong:
-- more assistance looked like a heavier lift). Clear the load-based bests; reps
-- per assistance level stay valid. Matched by slug because load_type cannot
-- be compared with 'assisted' in this transaction.
UPDATE "exercise_bests" AS b
SET "max_weight_grams" = 0, "max_set_volume_grams" = 0, "max_session_volume_grams" = 0, "estimated_1rm_grams" = 0, "updated_at" = now()
FROM "exercises" e
WHERE e.id = b.exercise_id AND e.slug IN ('assisted-pull-up', 'assisted-dip');
