import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { api, createTestApp, exerciseIdBySlug, setupOnboardedUser } from "./helpers.js"
import type { App } from "../src/app.js"
import type { PlanDto, WorkoutDto, WorkoutSummaryDto, ProgressOverviewDto, ExerciseProgressDto } from "@pondus/shared"

let app: App
let close: () => Promise<void>
beforeAll(async () => ({ app, close } = await createTestApp()))
afterAll(() => close())

const now = () => new Date().toISOString()

async function logWorkingSets(token: string, w: WorkoutDto, weights: Record<number, number>, reps = 10) {
  let current = w
  for (const ex of w.exercises.slice(0, 2)) {
    const working = ex.sets.filter(s => s.setType === "working")
    for (const [i, s] of working.entries()) {
      const res = await api(app, token, "PUT", `/workouts/${w.id}/exercises/${ex.id}/sets`, {
        clientId: s.clientId ?? randomUUID(),
        setNumber: s.setNumber,
        setType: "working",
        weightGrams: weights[i] ?? 60000,
        reps,
        rir: 2,
        completed: true,
        completedAt: now(),
        updatedAt: now(),
      })
      expect(res.status).toBe(200)
      current = res.json as WorkoutDto
    }
  }
  return current
}

describe("workouts", () => {
  it("runs the full flow: start from plan, log sets, pause, complete, summary, records, history, progression", async () => {
    const u = await setupOnboardedUser(app, { weeklyFrequency: 3, experienceLevel: "beginner" })
    const plan = (await api(app, u.token, "POST", "/plans/generate", {})).json as PlanDto
    const session = plan.currentVersion.sessions[0]!

    const clientId = randomUUID()
    const started = await api(app, u.token, "POST", "/workouts", { clientId, source: { type: "plan_session", planSessionId: session.id } })
    expect(started.status).toBe(201)
    const w = started.json as WorkoutDto
    expect(w.exercises.length).toBe(session.exercises.length)
    expect(w.exercises[0]!.sets.length).toBeGreaterThan(0)
    expect(w.exercises[0]!.previous).toBeNull()

    // Idempotent start: same clientId → same workout, 200.
    const again = await api(app, u.token, "POST", "/workouts", { clientId, source: { type: "plan_session", planSessionId: session.id } })
    expect(again.status).toBe(200)
    expect((again.json as WorkoutDto).id).toBe(w.id)
    // Only one active workout.
    expect((await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "empty" } })).status).toBe(409)
    expect(((await api(app, u.token, "GET", "/workouts/active")).json as WorkoutDto).id).toBe(w.id)

    const logged = await logWorkingSets(u.token, w, { 0: 60000, 1: 60000, 2: 60000 }, 10)
    expect(logged.exercises[0]!.sets.filter(s => s.completed).length).toBeGreaterThan(0)

    // Pause and resume accumulate paused time.
    const pausedAt = new Date(Date.now() - 60_000).toISOString()
    await api(app, u.token, "POST", `/workouts/${w.id}/pause`, { at: pausedAt })
    const resumed = (await api(app, u.token, "POST", `/workouts/${w.id}/resume`, {})).json as WorkoutDto
    expect(resumed.status).toBe("in_progress")
    expect(resumed.pausedSeconds).toBeGreaterThanOrEqual(59)

    const done = await api(app, u.token, "POST", `/workouts/${w.id}/complete`, {})
    expect(done.status).toBe(200)
    const summary = done.json as WorkoutSummaryDto
    expect(summary.workout.status).toBe("completed")
    expect(summary.workingSets).toBeGreaterThan(0)
    expect(summary.tonnageGrams).toBeGreaterThan(0)
    expect(summary.records.some(r => r.type === "max_weight")).toBe(true)
    expect(summary.comparison).toBeNull()
    // Untouched placeholder sets were dropped.
    expect(summary.workout.exercises.every(e => e.sets.every(s => s.completed))).toBe(true)
    // Completing twice is idempotent.
    expect((await api(app, u.token, "POST", `/workouts/${w.id}/complete`, {})).status).toBe(200)
    // Completed workouts are read-only.
    expect((await api(app, u.token, "PUT", `/workouts/${w.id}/exercises/${w.exercises[0]!.id}/sets`, { clientId: randomUUID(), setNumber: 9, updatedAt: now() })).status).toBe(409)

    // History and per-exercise history.
    const history = await api(app, u.token, "GET", "/workouts")
    expect((history.json as { items: { id: string }[] }).items[0]!.id).toBe(w.id)
    const exId = w.exercises[0]!.exerciseId!
    const exHistory = await api(app, u.token, "GET", `/exercises/${exId}/history`)
    expect((exHistory.json as { items: unknown[] }).items).toHaveLength(1)

    // Second workout: previous values are prefilled; heavier top set → new record and comparison.
    const w2 = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "plan_session", planSessionId: session.id } })).json as WorkoutDto
    expect(w2.exercises[0]!.previous).not.toBeNull()
    expect(w2.exercises[0]!.sets.find(s => s.setType === "working")!.targetWeightGrams).toBe(60000)
    await logWorkingSets(u.token, w2, { 0: 62500, 1: 62500, 2: 62500 }, 10)
    const summary2 = (await api(app, u.token, "POST", `/workouts/${w2.id}/complete`, {})).json as WorkoutSummaryDto
    expect(summary2.records.some(r => r.type === "max_weight" && r.weightGrams === 62500)).toBe(true)
    expect(summary2.comparison?.workoutId).toBe(w.id)

    // Progress overview and progression recommendation.
    const overview = (await api(app, u.token, "GET", "/progress/overview")).json as ProgressOverviewDto
    expect(overview.totalWorkouts).toBe(2)
    expect(overview.lastWorkout?.id).toBe(w2.id)
    expect(overview.recentRecords.length).toBeGreaterThan(0)
    expect(overview.weeklyVolume.length).toBeGreaterThan(0)
    expect(overview.muscleDistribution.length).toBeGreaterThan(0)
    const prog = (await api(app, u.token, "GET", `/progress/exercises/${exId}`)).json as ExerciseProgressDto
    expect(prog.points).toHaveLength(2)
    expect(prog.bests.maxWeightGrams).toBe(62500)
    expect(prog.recommendation).not.toBeNull()
    expect(["increase", "add_reps", "hold"]).toContain(prog.recommendation!.action)
    const records = await api(app, u.token, "GET", "/progress/records")
    expect((records.json as { items: unknown[] }).items.length).toBeGreaterThan(0)
  })

  it("plan edits never change completed workouts", async () => {
    const u = await setupOnboardedUser(app, { weeklyFrequency: 3 })
    const plan = (await api(app, u.token, "POST", "/plans/generate", {})).json as PlanDto
    const session = plan.currentVersion.sessions[0]!
    const w = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "plan_session", planSessionId: session.id } })).json as WorkoutDto
    await logWorkingSets(u.token, w, { 0: 50000 }, 8)
    const before = (await api(app, u.token, "POST", `/workouts/${w.id}/complete`, {})).json as WorkoutSummaryDto
    const alt = ((await api(app, u.token, "GET", `/exercises/${session.exercises[0]!.exerciseId}/alternatives`)).json as { exercise: { id: string } }[])[0]!.exercise.id
    await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "swap_exercise", planExerciseId: session.exercises[0]!.id, newExerciseId: alt }, { op: "remove_exercise", planExerciseId: session.exercises[1]!.id }] })
    await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/apply`, { previewId: ((await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/preview`, { weeklyFrequency: 4 })).json as { previewId: string }).previewId })
    const after = (await api(app, u.token, "GET", `/workouts/${w.id}`)).json as WorkoutDto
    expect(after.exercises.map(e => ({ id: e.exerciseId, name: e.exerciseNameSnapshot, sets: e.sets.map(s => [s.weightGrams, s.reps]) }))).toEqual(
      before.workout.exercises.map(e => ({ id: e.exerciseId, name: e.exerciseNameSnapshot, sets: e.sets.map(s => [s.weightGrams, s.reps]) })),
    )
    expect(after.trainingPlanVersionId).toBe(plan.currentVersion.id)
  })

  it("replays an offline batch idempotently and resolves stale set writes", async () => {
    const u = await setupOnboardedUser(app)
    const bench = await exerciseIdBySlug(app, u.token, "barbell-bench-press")
    const workoutClientId = randomUUID()
    const exerciseClientId = randomUUID()
    const setClientId = randomUUID()
    const t0 = new Date(Date.now() - 10 * 60_000).toISOString()
    const t1 = new Date(Date.now() - 5 * 60_000).toISOString()
    const batch = {
      mutations: [
        { kind: "start_workout", body: { clientId: workoutClientId, source: { type: "empty", name: "Offline" }, startedAt: t0 } },
        { kind: "add_exercise", workoutClientId, body: { clientId: exerciseClientId, exerciseId: bench, targetSets: 3 } },
        { kind: "upsert_set", workoutClientId, exerciseClientId, body: { clientId: setClientId, setNumber: 1, setType: "working", weightGrams: 80000, reps: 8, completed: true, completedAt: t1, updatedAt: t1 } },
        { kind: "complete", workoutClientId, body: { completedAt: now() } },
      ],
    }
    const first = await api(app, u.token, "POST", "/sync/workouts", batch)
    expect(first.status).toBe(200)
    expect((first.json as { applied: number }).applied).toBe(4)
    const replay = await api(app, u.token, "POST", "/sync/workouts", batch)
    const r = replay.json as { applied: number; results: { status: string }[]; workouts: WorkoutDto[] }
    // Nothing is applied twice: start/add/complete are duplicates; the set write is equal-or-older → not applied.
    expect(r.results.map(x => x.status)).toEqual(["duplicate", "duplicate", "duplicate", "duplicate"])
    const [wk] = r.workouts
    expect(wk!.exercises).toHaveLength(1)
    expect(wk!.exercises[0]!.sets.filter(s => s.setType === "working")).toHaveLength(1)
    const history = await api(app, u.token, "GET", "/workouts")
    expect((history.json as { items: unknown[] }).items).toHaveLength(1)
  })

  it("honours the Idempotency-Key header for POST requests", async () => {
    const u = await setupOnboardedUser(app)
    const key = randomUUID()
    const body = { nameDe: "Idempotente Übung", category: "isolation", movementPattern: "elbow_flexion", equipment: ["dumbbell"], loadType: "free_weight", primaryMuscles: ["biceps"] }
    const a = await api(app, u.token, "POST", "/exercises", body, { "idempotency-key": key })
    const b = await api(app, u.token, "POST", "/exercises", body, { "idempotency-key": key })
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    expect((b.json as { id: string }).id).toBe((a.json as { id: string }).id)
    expect(b.headers["idempotent-replayed"]).toBe("true")
    const c = await api(app, u.token, "POST", "/exercises", { ...body, nameDe: "Andere" }, { "idempotency-key": key })
    expect(c.status).toBe(409)
  })

  it("blocks cross-user access to workouts", async () => {
    const a = await setupOnboardedUser(app)
    const b = await setupOnboardedUser(app)
    const w = (await api(app, a.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "empty" } })).json as WorkoutDto
    expect((await api(app, b.token, "GET", `/workouts/${w.id}`)).status).toBe(404)
    expect((await api(app, b.token, "POST", `/workouts/${w.id}/complete`, {})).status).toBe(404)
  })
})
