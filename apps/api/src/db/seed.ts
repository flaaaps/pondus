/**
 * Idempotent reference-data seed: muscle groups and the system exercise
 * library. Safe to re-run; system exercises are upserted by slug so edits to
 * the library propagate without touching user data. Never seeds demo users.
 */
import { EXERCISE_LIBRARY, MUSCLE_GROUPS } from "@pondus/shared"
import { eq, sql } from "drizzle-orm"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createDb, type DbOrTx } from "./client.js"
import { exerciseAlternatives, exerciseMuscles, exercises, muscleGroups } from "./schema.js"

export async function seedReferenceData(db: DbOrTx) {
  await db
    .insert(muscleGroups)
    .values(MUSCLE_GROUPS.map(m => ({ slug: m.slug, nameDe: m.nameDe, nameEn: m.nameEn, region: m.region, displayOrder: m.displayOrder })))
    .onConflictDoUpdate({
      target: muscleGroups.slug,
      set: { nameDe: sql`excluded.name_de`, nameEn: sql`excluded.name_en`, region: sql`excluded.region`, displayOrder: sql`excluded.display_order` },
    })
  const muscles = await db.select().from(muscleGroups)
  const muscleIdBySlug = new Map(muscles.map(m => [m.slug, m.id] as const))

  const rows = EXERCISE_LIBRARY.map(e => ({
    slug: e.slug,
    nameDe: e.nameDe,
    nameEn: e.nameEn,
    aliases: e.aliases,
    category: e.category,
    movementPattern: e.movementPattern,
    equipment: e.equipment,
    loadType: e.loadType,
    difficulty: e.difficulty,
    isUnilateral: e.isUnilateral,
    description: e.description,
    cues: e.cues,
    commonMistakes: e.commonMistakes,
    setSeconds: e.setSeconds ?? null,
    isSystem: true,
    ownerUserId: null,
  }))
  for (let i = 0; i < rows.length; i += 50) {
    await db
      .insert(exercises)
      .values(rows.slice(i, i + 50))
      .onConflictDoUpdate({
        target: exercises.slug,
        set: {
          nameDe: sql`excluded.name_de`,
          nameEn: sql`excluded.name_en`,
          aliases: sql`excluded.aliases`,
          category: sql`excluded.category`,
          movementPattern: sql`excluded.movement_pattern`,
          equipment: sql`excluded.equipment`,
          loadType: sql`excluded.load_type`,
          difficulty: sql`excluded.difficulty`,
          isUnilateral: sql`excluded.is_unilateral`,
          description: sql`excluded.description`,
          cues: sql`excluded.cues`,
          commonMistakes: sql`excluded.common_mistakes`,
          setSeconds: sql`excluded.set_seconds`,
          updatedAt: sql`now()`,
        },
      })
  }
  const systemExercises = await db.select({ id: exercises.id, slug: exercises.slug }).from(exercises).where(eq(exercises.isSystem, true))
  const idBySlug = new Map(systemExercises.map(e => [e.slug, e.id] as const))

  // Rebuild muscle links and alternatives for system exercises (reference data, not user data).
  const systemIds = systemExercises.map(e => e.id)
  if (systemIds.length) {
    await db.execute(sql`delete from exercise_muscles where exercise_id in (select id from exercises where is_system = true)`)
    await db.execute(sql`delete from exercise_alternatives where exercise_id in (select id from exercises where is_system = true)`)
  }
  const muscleRows: (typeof exerciseMuscles.$inferInsert)[] = []
  const altRows: (typeof exerciseAlternatives.$inferInsert)[] = []
  for (const e of EXERCISE_LIBRARY) {
    const exerciseId = idBySlug.get(e.slug)
    if (!exerciseId) continue
    for (const m of e.primaryMuscles) muscleRows.push({ exerciseId, muscleGroupId: muscleIdBySlug.get(m)!, role: "primary" })
    for (const m of e.secondaryMuscles) if (!e.primaryMuscles.includes(m)) muscleRows.push({ exerciseId, muscleGroupId: muscleIdBySlug.get(m)!, role: "secondary" })
    for (const alt of e.alternatives) {
      const altId = idBySlug.get(alt)
      if (altId) altRows.push({ exerciseId, alternativeExerciseId: altId })
    }
  }
  for (let i = 0; i < muscleRows.length; i += 200) await db.insert(exerciseMuscles).values(muscleRows.slice(i, i + 200))
  for (let i = 0; i < altRows.length; i += 200) await db.insert(exerciseAlternatives).values(altRows.slice(i, i + 200))
  return { muscleGroups: muscles.length, exercises: systemExercises.length }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")
  const { db, pool } = createDb(url, { max: 2 })
  try {
    const result = await db.transaction(tx => seedReferenceData(tx))
    console.log(`Seeded ${result.muscleGroups} muscle groups and ${result.exercises} system exercises.`)
  } finally {
    await pool.end()
  }
}
