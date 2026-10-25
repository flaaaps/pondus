-- Stable session identity across plan versions (B-01).
-- Every new version gets new session ids; session_key stays the same for a
-- session that is carried over. Additive only: existing rows are backfilled,
-- nothing is dropped.

ALTER TABLE "training_plan_sessions" ADD COLUMN "session_key" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
-- Backfill: sessions of the same plan with the same sequence share one key
-- (the id of that sequence's session in the oldest version).
UPDATE "training_plan_sessions" AS s
SET "session_key" = k.key
FROM (
  SELECT s2.id,
         first_value(s2.id) OVER (PARTITION BY v.training_plan_id, s2.sequence ORDER BY v.version_number, s2.id) AS key
  FROM "training_plan_sessions" s2
  JOIN "training_plan_versions" v ON v.id = s2.training_plan_version_id
) AS k
WHERE k.id = s.id;--> statement-breakpoint
CREATE INDEX "plan_sessions_key_idx" ON "training_plan_sessions" USING btree ("session_key");--> statement-breakpoint

ALTER TABLE "session_overrides" ADD COLUMN "session_key" uuid;--> statement-breakpoint
UPDATE "session_overrides" AS o
SET "session_key" = s.session_key
FROM "training_plan_sessions" s
WHERE s.id = o.training_plan_session_id;--> statement-breakpoint
-- Overrides made on older versions of the same session in the same week are
-- superseded by the most recent one; keep only that one so the key is unique.
DELETE FROM "session_overrides" AS o
USING "session_overrides" AS newer
WHERE newer.user_id = o.user_id
  AND newer.session_key = o.session_key
  AND newer.week_start = o.week_start
  AND (newer.updated_at, newer.id) > (o.updated_at, o.id);--> statement-breakpoint
ALTER TABLE "session_overrides" ALTER COLUMN "session_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "session_overrides_key_week_idx" ON "session_overrides" USING btree ("user_id","session_key","week_start");--> statement-breakpoint

ALTER TABLE "workouts" ADD COLUMN "source_session_key" uuid;--> statement-breakpoint
UPDATE "workouts" AS w
SET "source_session_key" = s.session_key
FROM "training_plan_sessions" s
WHERE s.id = w.source_session_id;--> statement-breakpoint
CREATE INDEX "workouts_user_session_key_idx" ON "workouts" USING btree ("user_id","source_session_key");
