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
    // First time an exercise is trained: baseline only, no "records" (B-21).
    expect(summary.records).toHaveLength(0)
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
    // Targets come from nextTargets: 60 kg × 10 @ RIR 2 → load goes up or stays, never silently random.
    const nt = w2.exercises[0]!.nextTarget!
    expect(nt).toBeTruthy()
    expect(nt.lastWeightGrams).toBe(60000)
    expect(["increase_load", "increase_reps", "hold"]).toContain(nt.kind)
    expect(nt.reason.length).toBeGreaterThan(0)
    const firstWorking = w2.exercises[0]!.sets.find(s => s.setType === "working")!
    expect(firstWorking.targetWeightGrams).toBe(nt.weightGrams)
    expect(firstWorking.weightGrams).toBe(nt.weightGrams)
    expect(firstWorking.targetReps).toBe(nt.repsPerSet[0])
    if (nt.kind === "increase_load") expect(nt.weightGrams!).toBeGreaterThan(60000)
    else expect(nt.weightGrams).toBe(60000)
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

  it("swaps an exercise, swaps the stand-in again, removes it and restores the original – by server id and by client id", async () => {
    const u = await setupOnboardedUser(app)
    const bench = await exerciseIdBySlug(app, u.token, "barbell-bench-press")
    const dbBench = await exerciseIdBySlug(app, u.token, "dumbbell-bench-press")
    const machine = await exerciseIdBySlug(app, u.token, "machine-chest-press")
    const workoutClientId = randomUUID()
    let w = (await api(app, u.token, "POST", "/workouts", { clientId: workoutClientId, source: { type: "empty" } })).json as WorkoutDto
    w = (await api(app, u.token, "POST", `/workouts/${w.id}/exercises`, { clientId: randomUUID(), exerciseId: bench, targetSets: 3 })).json as WorkoutDto
    const original = w.exercises[0]!

    // Swap by server id (REST): the original is skipped, the stand-in follows it and points back at it.
    const standInClientId = randomUUID()
    w = (await api(app, u.token, "POST", `/workouts/${w.id}/exercises`, { clientId: standInClientId, exerciseId: dbBench, targetSets: 3, replacesWorkoutExerciseId: original.id })).json as WorkoutDto
    expect(w.exercises.map(e => [e.sequence, e.skipped])).toEqual([
      [1, true],
      [2, false],
    ])
    const standIn = w.exercises[1]!
    expect(standIn.replacesWorkoutExerciseId).toBe(original.id)

    // Swap the stand-in again, addressed by its client id (that is all the app knows before a sync), through the offline sync path.
    const secondClientId = randomUUID()
    const sync = await api(app, u.token, "POST", "/sync/workouts", {
      mutations: [{ kind: "add_exercise", workoutClientId, body: { clientId: secondClientId, exerciseId: machine, targetSets: 2, replacesWorkoutExerciseId: standInClientId, sequence: 3 } }],
    })
    expect(sync.status).toBe(200)
    const synced = sync.json as { results: { status: string; message?: string }[]; workouts: WorkoutDto[] }
    expect(synced.results[0]).toMatchObject({ status: "applied" })
    w = synced.workouts[0]!
    expect(w.exercises.map(e => [e.sequence, e.skipped, e.clientId === secondClientId])).toEqual([
      [1, true, false],
      [2, true, false],
      [3, false, true],
    ])
    expect(w.exercises[2]!.replacesWorkoutExerciseId).toBe(standIn.id)

    // Swap back: un-skip the stand-in by client id and remove the second stand-in; the gap in the sequence closes.
    const back = await api(app, u.token, "POST", "/sync/workouts", {
      mutations: [
        { kind: "update_exercise", workoutClientId, exerciseClientId: standInClientId, body: { skipped: false } },
        { kind: "remove_exercise", workoutClientId, exerciseClientId: secondClientId },
      ],
    })
    expect((back.json as { results: { status: string }[] }).results.map(r => r.status)).toEqual(["applied", "applied"])
    w = (await api(app, u.token, "GET", `/workouts/${w.id}`)).json as WorkoutDto
    expect(w.exercises.map(e => [e.sequence, e.skipped])).toEqual([
      [1, true],
      [2, false],
    ])

    // Restore the original (REST, by id) and drop the stand-in; removing it twice is harmless.
    w = (await api(app, u.token, "PATCH", `/workouts/${w.id}/exercises/${original.id}`, { skipped: false })).json as WorkoutDto
    w = (await api(app, u.token, "DELETE", `/workouts/${w.id}/exercises/${standInClientId}`)).json as WorkoutDto
    expect((await api(app, u.token, "DELETE", `/workouts/${w.id}/exercises/${standInClientId}`)).status).toBe(200)
    expect(w.exercises.map(e => [e.id, e.sequence, e.skipped])).toEqual([[original.id, 1, false]])
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

async function logExercise(token: string, workoutId: string, ex: WorkoutDto["exercises"][number], sets: { weightGrams: number | null; reps: number; rir: number | null }[]) {
  const working = ex.sets.filter(s => s.setType === "working")
  for (const [i, v] of sets.entries()) {
    const s = working[i]
    const res = await api(app, token, "PUT", `/workouts/${workoutId}/exercises/${ex.id}/sets`, {
      clientId: s?.clientId ?? randomUUID(),
      setNumber: s?.setNumber ?? i + 1,
      setType: "working",
      ...v,
      completed: true,
      completedAt: now(),
      updatedAt: now(),
    })
    expect(res.status).toBe(200)
  }
}

describe("progression targets at workout start (API-6)", () => {
  it("prefills sets from nextTargets: no_data first, then increase_load / hold", async () => {
    const u = await setupOnboardedUser(app, { weeklyFrequency: 3 })
    const plan = (await api(app, u.token, "POST", "/plans/generate", {})).json as PlanDto
    const session = plan.currentVersion.sessions[0]!
    const pe = session.exercises[0]!

    const w1 = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "plan_session", planSessionId: session.id } })).json as WorkoutDto
    const e1 = w1.exercises[0]!
    expect(e1.nextTarget?.kind).toBe("no_data")
    expect(e1.nextTarget?.weightGrams).toBeNull()
    expect(e1.nextTarget?.repsPerSet).toEqual(Array(pe.targetSets).fill(pe.targetRepsMin))
    expect(e1.sets.filter(s => s.setType === "working").every(s => s.weightGrams === null && s.reps === pe.targetRepsMin)).toBe(true)
    // Top of the rep range at the target RIR on every set → add load next time.
    await logExercise(u.token, w1.id, e1, Array.from({ length: pe.targetSets }, () => ({ weightGrams: 60000, reps: pe.targetRepsMax, rir: pe.targetRir })))
    await api(app, u.token, "POST", `/workouts/${w1.id}/complete`, {})

    const w2 = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "plan_session", planSessionId: session.id } })).json as WorkoutDto
    const e2 = w2.exercises[0]!
    expect(e2.nextTarget?.kind).toBe("increase_load")
    expect(e2.nextTarget!.weightGrams!).toBeGreaterThan(60000)
    expect(e2.nextTarget!.lastWeightGrams).toBe(60000)
    const working2 = e2.sets.filter(s => s.setType === "working")
    expect(working2).toHaveLength(pe.targetSets)
    expect(working2.every(s => s.targetWeightGrams === e2.nextTarget!.weightGrams && s.weightGrams === e2.nextTarget!.weightGrams && s.reps === pe.targetRepsMin)).toBe(true)
    // The DTO still shows last time's values separately.
    expect(e2.previous?.sets[0]?.weightGrams).toBe(60000)
    // Missed the bottom of the range → hold the weight.
    await logExercise(u.token, w2.id, e2, Array.from({ length: pe.targetSets }, () => ({ weightGrams: e2.nextTarget!.weightGrams, reps: Math.max(1, pe.targetRepsMin - 2), rir: 0 })))
    await api(app, u.token, "POST", `/workouts/${w2.id}/complete`, {})
    const w3 = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "plan_session", planSessionId: session.id } })).json as WorkoutDto
    expect(w3.exercises[0]!.nextTarget?.kind).toBe("hold")
    expect(w3.exercises[0]!.nextTarget?.weightGrams).toBe(e2.nextTarget!.weightGrams)
  })

  it("exercises added without a rep range keep the last-values prefill and have no nextTarget", async () => {
    const u = await setupOnboardedUser(app)
    const bench = await exerciseIdBySlug(app, u.token, "barbell-bench-press")
    const w = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "empty" } })).json as WorkoutDto
    const added = (await api(app, u.token, "POST", `/workouts/${w.id}/exercises`, { clientId: randomUUID(), exerciseId: bench })).json as WorkoutDto
    expect(added.exercises[0]!.nextTarget).toBeNull()
  })
})

describe("assisted exercises", () => {
  it("never turns assistance into weight records, bests or tonnage", async () => {
    const u = await setupOnboardedUser(app)
    const assisted = await exerciseIdBySlug(app, u.token, "assisted-pull-up")
    expect(await exerciseIdBySlug(app, u.token, "assisted-dip")).toBeTruthy()
    const run = async (assistance: number, reps: number) => {
      const w = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "empty" } })).json as WorkoutDto
      const withEx = (await api(app, u.token, "POST", `/workouts/${w.id}/exercises`, { clientId: randomUUID(), exerciseId: assisted, targetSets: 3, targetRepsMin: 6, targetRepsMax: 10, targetRir: 2 })).json as WorkoutDto
      const ex = withEx.exercises[0]!
      await logExercise(u.token, w.id, ex, [0, 1, 2].map(() => ({ weightGrams: assistance, reps, rir: 2 })))
      return { start: ex, summary: (await api(app, u.token, "POST", `/workouts/${w.id}/complete`, {})).json as WorkoutSummaryDto }
    }
    const first = await run(30000, 10)
    expect(first.summary.records).toHaveLength(0)
    expect(first.summary.tonnageGrams).toBe(0)
    // More assistance is easier: never a max_weight record.
    const second = await run(40000, 10)
    expect(second.start.nextTarget?.kind).toBe("increase_load")
    // Progression for assisted = less assistance.
    expect(second.start.nextTarget!.weightGrams!).toBeLessThan(30000)
    expect(second.summary.records.filter(r => r.type !== "max_reps_at_weight")).toHaveLength(0)
    const prog = (await api(app, u.token, "GET", `/progress/exercises/${assisted}`)).json as ExerciseProgressDto
    expect(prog.bests.maxWeightGrams).toBe(0)
    expect(prog.bests.estimated1rmGrams).toBe(0)
    expect(prog.points.every(p => p.tonnageGrams === 0 && p.estimated1rmGrams === null)).toBe(true)
    // Top set for assisted = least assistance.
    expect(prog.points[1]!.topWeightGrams).toBe(40000)
    const overview = (await api(app, u.token, "GET", "/progress/overview")).json as ProgressOverviewDto
    expect(overview.weeklyVolume.reduce((a, w) => a + w.tonnageGrams, 0)).toBe(0)
  })
})

describe("regressions from simulator verification", () => {
  // One user for both cases: the auth routes are rate limited to 10 registrations per minute.
  let u: Awaited<ReturnType<typeof setupOnboardedUser>>
  beforeAll(async () => {
    u = await setupOnboardedUser(app)
  })

  it("assisted target keeps the logged assistance when some sets have no weight", async () => {
    const assisted = await exerciseIdBySlug(app, u.token, "assisted-pull-up")
    const addAssisted = async () => {
      const w = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "empty" } })).json as WorkoutDto
      return { w, ex: ((await api(app, u.token, "POST", `/workouts/${w.id}/exercises`, { clientId: randomUUID(), exerciseId: assisted, targetSets: 4, targetRepsMin: 6, targetRepsMax: 10, targetRir: 2 })).json as WorkoutDto).exercises[0]! }
    }
    const first = await addAssisted()
    await logExercise(u.token, first.w.id, first.ex, [{ weightGrams: 2500, reps: 6, rir: 2 }, { weightGrams: null, reps: 6, rir: 2 }, { weightGrams: 40000, reps: 6, rir: 2 }, { weightGrams: null, reps: 6, rir: 2 }])
    await api(app, u.token, "POST", `/workouts/${first.w.id}/complete`, {})
    const second = await addAssisted()
    expect(second.ex.nextTarget?.weightGrams).toBe(2500)
    expect(second.ex.nextTarget?.lastWeightGrams).toBe(2500)
    expect(second.ex.sets.filter(s => s.setType === "working").every(s => s.weightGrams === 2500 && s.targetWeightGrams === 2500)).toBe(true)
    expect((await api(app, u.token, "POST", `/workouts/${second.w.id}/cancel`)).status).toBe(200)
  })

  it("weekly tonnage counts loaded sets and only drops assisted ones", async () => {
    const bench = await exerciseIdBySlug(app, u.token, "barbell-bench-press")
    const assisted = await exerciseIdBySlug(app, u.token, "assisted-pull-up")
    const w = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "empty" } })).json as WorkoutDto
    await api(app, u.token, "POST", `/workouts/${w.id}/exercises`, { clientId: randomUUID(), exerciseId: bench, targetSets: 2 })
    const full = (await api(app, u.token, "POST", `/workouts/${w.id}/exercises`, { clientId: randomUUID(), exerciseId: assisted, targetSets: 2 })).json as WorkoutDto
    await logExercise(u.token, w.id, full.exercises[0]!, [{ weightGrams: 60000, reps: 10, rir: 2 }, { weightGrams: 60000, reps: 10, rir: 2 }])
    await logExercise(u.token, w.id, full.exercises[1]!, [{ weightGrams: 40000, reps: 8, rir: 2 }, { weightGrams: 40000, reps: 8, rir: 2 }])
    const summary = (await api(app, u.token, "POST", `/workouts/${w.id}/complete`, {})).json as WorkoutSummaryDto
    expect(summary.tonnageGrams).toBe(1_200_000)
    const overview = (await api(app, u.token, "GET", "/progress/overview")).json as ProgressOverviewDto
    expect(overview.weeklyVolume.at(-1)!.tonnageGrams).toBe(1_200_000)
    expect(overview.lastWorkout!.tonnageGrams).toBe(1_200_000)
    const history = (await api(app, u.token, "GET", "/workouts")).json as { items: { id: string; tonnageGrams: number }[] }
    expect(history.items.find(i => i.id === w.id)!.tonnageGrams).toBe(1_200_000)
  })
})
