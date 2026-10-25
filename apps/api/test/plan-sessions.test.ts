import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { defaultPlanName, type PlanDto, type PlanWeekDto, type AdjustmentPreviewDto, type ProgressOverviewDto, type WorkoutDto } from "@pondus/shared"
import { api, createTestApp, exerciseIdBySlug, registerUser, setupOnboardedUser } from "./helpers.js"
import type { App } from "../src/app.js"
import { normalizeSearch } from "../src/modules/exercises/service.js"

let app: App
let close: () => Promise<void>
beforeAll(async () => ({ app, close } = await createTestApp()))
afterAll(() => close())

const weekShape = (w: PlanWeekDto) => w.sessions.map(s => ({ key: s.sessionKey, status: s.status, date: s.date, workoutId: s.workoutId }))
const keyOfNext = (w: PlanWeekDto) => w.sessions.find(s => s.planSessionId === w.nextSessionId)?.sessionKey

describe("stable session keys across plan versions (B-01)", () => {
  it("keeps completed, moved and skipped sessions of this week after an exercise swap", async () => {
    const u = await setupOnboardedUser(app, { weeklyFrequency: 4 })
    const plan = (await api(app, u.token, "POST", "/plans/generate", {})).json as PlanDto
    const [a, b, c] = plan.currentVersion.sessions
    expect(a!.sessionKey).toBeTruthy()

    // A absolvieren
    const started = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "plan_session", planSessionId: a!.id } })).json as { id: string; sourceSessionKey: string }
    expect(started.sourceSessionKey).toBe(a!.sessionKey)
    expect((await api(app, u.token, "POST", `/workouts/${started.id}/complete`, {})).status).toBe(200)

    const week0 = (await api(app, u.token, "GET", "/plans/week")).json as PlanWeekDto
    // B verschieben, C auslassen
    const moveTo = week0.weekEnd
    expect((await api(app, u.token, "POST", `/plans/sessions/${b!.id}/override`, { weekStart: week0.weekStart, action: "move", date: moveTo })).status).toBe(200)
    expect((await api(app, u.token, "POST", `/plans/sessions/${c!.id}/override`, { weekStart: week0.weekStart, action: "skip" })).status).toBe(200)
    const before = (await api(app, u.token, "GET", "/plans/week")).json as PlanWeekDto
    expect(before.sessions[0]!.status).toBe("completed")
    expect(before.sessions[1]!.date).toBe(moveTo)
    expect(before.sessions[2]!.status).toBe("skipped")
    expect(keyOfNext(before)).not.toBe(a!.sessionKey)

    // Übung tauschen → neue Version, neue Session-IDs
    const target = a!.exercises[0]!
    const alt = ((await api(app, u.token, "GET", `/exercises/${target.exerciseId}/alternatives`)).json as { exercise: { id: string } }[])[0]!.exercise.id
    const edited = (await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "swap_exercise", planExerciseId: target.id, newExerciseId: alt }] })).json as PlanDto
    expect(edited.currentVersion.versionNumber).toBe(2)
    expect(edited.currentVersion.sessions[0]!.id).not.toBe(a!.id)
    expect(edited.currentVersion.sessions.map(s => s.sessionKey)).toEqual(plan.currentVersion.sessions.map(s => s.sessionKey))

    const after = (await api(app, u.token, "GET", "/plans/week")).json as PlanWeekDto
    expect(weekShape(after)).toEqual(weekShape(before))
    expect(keyOfNext(after)).toBe(keyOfNext(before))

    // Overrides set on the new version replace the old one (same key), reset clears it.
    const newB = edited.currentVersion.sessions[1]!
    const reset = (await api(app, u.token, "POST", `/plans/sessions/${newB.id}/override`, { weekStart: week0.weekStart, action: "reset" })).json as PlanWeekDto
    expect(reset.sessions[1]!.date).toBe(week0.sessions[1]!.date)
    expect(reset.sessions[2]!.status).toBe("skipped")

    // Removing a session and re-ordering keeps the others matched.
    const v2 = edited.currentVersion
    const reordered = (await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "reorder_sessions", sessionIds: [v2.sessions[2]!.id, v2.sessions[0]!.id, v2.sessions[1]!.id, v2.sessions[3]!.id] }] })).json as PlanDto
    const wk = (await api(app, u.token, "GET", "/plans/week")).json as PlanWeekDto
    expect(reordered.currentVersion.sessions[0]!.sessionKey).toBe(c!.sessionKey)
    expect(wk.sessions.find(s => s.sessionKey === a!.sessionKey)!.status).toBe("completed")
    expect(wk.sessions.find(s => s.sessionKey === c!.sessionKey)!.status).toBe("skipped")

    // Summary comparison finds the previous workout of the same session across versions.
    const again = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "plan_session", planSessionId: reordered.currentVersion.sessions[1]!.id } })).json as { id: string }
    const summary = (await api(app, u.token, "POST", `/workouts/${again.id}/complete`, {})).json as { comparison: { workoutId: string } | null }
    expect(summary.comparison?.workoutId).toBe(started.id)
  })

  it("coalesces rapid edits into one version with stable session ids", async () => {
    const u = await setupOnboardedUser(app, { weeklyFrequency: 3 })
    const plan = (await api(app, u.token, "POST", "/plans/generate", {})).json as PlanDto
    const ex = (p: PlanDto) => p.currentVersion.sessions[0]!.exercises[0]!
    const e1 = (await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "update_exercise", planExerciseId: ex(plan).id, params: { targetSets: 4 } }] })).json as PlanDto
    expect(e1.currentVersion.versionNumber).toBe(2)
    const e2 = (await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "update_exercise", planExerciseId: ex(e1).id, params: { targetSets: 5 } }] })).json as PlanDto
    const e3 = (await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "add_session", name: "Extra", weekday: 6 }] })).json as PlanDto
    expect(e2.currentVersion.versionNumber).toBe(2)
    expect(e3.currentVersion.versionNumber).toBe(2)
    expect(e2.currentVersion.sessions.map(s => s.id)).toEqual(e1.currentVersion.sessions.map(s => s.id))
    expect(e3.currentVersion.sessions.slice(0, 3).map(s => s.id)).toEqual(e1.currentVersion.sessions.map(s => s.id))
    expect(ex(e3).targetSets).toBe(5)
    // v1 is untouched.
    const v1 = (await api(app, u.token, "GET", `/plans/${plan.id}/versions/1`)).json as PlanDto["currentVersion"]
    expect(v1.sessions[0]!.exercises[0]!.targetSets).toBe(ex(plan).targetSets)
    const e4 = (await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "remove_session", sessionId: e3.currentVersion.sessions[3]!.id }] })).json as PlanDto
    expect(e4.currentVersion.versionNumber).toBe(2)
    expect(e4.currentVersion.sessions).toHaveLength(3)

    // Once a workout references the version, the next edit creates a new one.
    const w = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "plan_session", planSessionId: e4.currentVersion.sessions[0]!.id } })).json as { id: string }
    const e5 = (await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "update_exercise", planExerciseId: ex(e4).id, params: { targetSets: 3 } }] })).json as PlanDto
    expect(e5.currentVersion.versionNumber).toBe(3)
    const wk = (await api(app, u.token, "GET", "/plans/week")).json as PlanWeekDto
    expect(wk.sessions[0]!.workoutId).toBe(w.id)
    expect(wk.sessions[0]!.status).toBe("in_progress")
  })

  it("does not coalesce into a version a pending adjustment preview is based on", async () => {
    const u = await setupOnboardedUser(app, { weeklyFrequency: 3 })
    const plan = (await api(app, u.token, "POST", "/plans/generate", {})).json as PlanDto
    const ex = (p: PlanDto) => p.currentVersion.sessions[0]!.exercises[0]!
    const e1 = (await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "update_exercise", planExerciseId: ex(plan).id, params: { targetSets: 4 } }] })).json as PlanDto
    const preview = (await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/preview`, { weeklyFrequency: 4, updateProfile: false })).json as AdjustmentPreviewDto
    const e2 = (await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "update_exercise", planExerciseId: ex(e1).id, params: { targetSets: 5 } }] })).json as PlanDto
    expect(e2.currentVersion.versionNumber).toBe(3)
    expect((await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/apply`, { previewId: preview.previewId })).status).toBe(409)
  })
})

describe("adjustments", () => {
  it("renames auto-named plans to the new split/frequency and keeps manual names (B-09)", async () => {
    const u = await setupOnboardedUser(app, { weeklyFrequency: 3 })
    const plan = (await api(app, u.token, "POST", "/plans/generate", {})).json as PlanDto
    expect(plan.name).toBe(defaultPlanName(plan.currentVersion.splitType, 3))
    const week0 = (await api(app, u.token, "GET", "/plans/week")).json as PlanWeekDto
    await api(app, u.token, "POST", `/plans/sessions/${plan.currentVersion.sessions[0]!.id}/override`, { weekStart: week0.weekStart, action: "skip" })
    const preview = (await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/preview`, { weeklyFrequency: 4 })).json as AdjustmentPreviewDto
    const applied = (await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/apply`, { previewId: preview.previewId })).json as PlanDto
    expect(applied.name).toBe(defaultPlanName(applied.currentVersion.splitType, 4))
    // Session keys carry over by sequence; the 4th session is new.
    expect(applied.currentVersion.sessions.slice(0, 3).map(s => s.sessionKey)).toEqual(plan.currentVersion.sessions.map(s => s.sessionKey))
    const week1 = (await api(app, u.token, "GET", "/plans/week")).json as PlanWeekDto
    expect(week1.sessions[0]!.status).toBe("skipped")

    await api(app, u.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "rename_plan", name: "Mein Plan" }] })
    const p2 = (await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/preview`, { weeklyFrequency: 3 })).json as AdjustmentPreviewDto
    const applied2 = (await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/apply`, { previewId: p2.previewId })).json as PlanDto
    expect(applied2.name).toBe("Mein Plan")
  })
})

describe("week time zone (B-16)", () => {
  it("computes today and the default week in the requested zone, Europe/Berlin by default", async () => {
    const u = await setupOnboardedUser(app)
    await api(app, u.token, "POST", "/plans/generate", {})
    const def = (await api(app, u.token, "GET", "/plans/week")).json as PlanWeekDto
    expect(def.timeZone).toBe("Europe/Berlin")
    expect(def.today).toBe(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date()))
    const kiritimati = (await api(app, u.token, "GET", "/plans/week?timeZone=Pacific/Kiritimati")).json as PlanWeekDto
    expect(kiritimati.today).toBe(new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Kiritimati" }).format(new Date()))
    const bogus = await api(app, u.token, "GET", "/plans/week?timeZone=Not/AZone")
    expect(bogus.status).toBe(200)
    expect((bogus.json as PlanWeekDto).timeZone).toBe("Europe/Berlin")
    const fixed = (await api(app, u.token, "GET", "/plans/week?date=2026-10-21")).json as PlanWeekDto
    expect(fixed.weekStart).toBe("2026-10-19")
  })
})

describe("exercise search (B-10, B-12)", () => {
  it("normalises umlauts, ß, case and hyphens and matches tokens", async () => {
    expect(normalizeSearch("Bankdrücken (Langhantel)")).toEqual(["bankdruecken langhantel", "bankdrucken langhantel"])
    expect(normalizeSearch("Fuß-Heben")[0]).toBe("fuss heben")
    const u = await registerUser(app)
    const bench = await exerciseIdBySlug(app, u.token, "barbell-bench-press")
    for (const q of ["bankdrucken", "bankdrücken", "Bankdruecken", "BANKDRÜCKEN", "bank drücken", "drücken lang"]) {
      const res = (await api(app, u.token, "GET", `/exercises?q=${encodeURIComponent(q)}&limit=100`)).json as { items: { id: string }[] }
      expect(res.items.map(i => i.id), q).toContain(bench)
    }
    const tbar = (await api(app, u.token, "GET", "/exercises?q=tbar&limit=100")).json as { items: { slug: string }[] }
    expect(tbar.items.length).toBeGreaterThan(0)
    expect(tbar.items.every(i => i.slug.includes("t-bar"))).toBe(true)
  })

  it("filters equipment with OR semantics", async () => {
    const u = await registerUser(app)
    const get = async (eq: string) => ((await api(app, u.token, "GET", `/exercises?muscles=chest&equipment=${eq}&limit=100`)).json as { total: number; items: { equipment: string[] }[] })
    const db = await get("dumbbell")
    const bb = await get("barbell")
    const both = await get("barbell,dumbbell")
    expect(db.total).toBeGreaterThan(0)
    expect(both.total).toBeGreaterThanOrEqual(Math.max(db.total, bb.total))
    for (const e of both.items) expect(e.equipment.some(x => x === "barbell" || x === "dumbbell")).toBe(true)
  })
})

describe("progress overview", () => {
  it("reports this week's sets per muscle against the plan target", async () => {
    const u = await setupOnboardedUser(app, { weeklyFrequency: 3 })
    const plan = (await api(app, u.token, "POST", "/plans/generate", {})).json as PlanDto
    const res = (await api(app, u.token, "GET", "/progress/overview")).json as ProgressOverviewDto
    expect(res.muscleWeeklySets!.length).toBeGreaterThan(3)
    const chest = res.muscleWeeklySets!.find(m => m.muscle === "chest")!
    expect(chest.targetSets).toBe(plan.currentVersion.weeklySets.chest)
    expect(chest.actualSets).toBe(0)
    expect(chest.label).toBe("Brust")
  })

  it("counts drop sets as half a set and warm-ups not at all", async () => {
    const u = await setupOnboardedUser(app, { weeklyFrequency: 3 })
    await api(app, u.token, "POST", "/plans/generate", {})
    const bench = await exerciseIdBySlug(app, u.token, "barbell-bench-press")
    const w = (await api(app, u.token, "POST", "/workouts", { clientId: randomUUID(), source: { type: "empty" } })).json as WorkoutDto
    const withEx = (await api(app, u.token, "POST", `/workouts/${w.id}/exercises`, { clientId: randomUUID(), exerciseId: bench, targetSets: 1 })).json as WorkoutDto
    const ex = withEx.exercises[0]!
    const at = new Date().toISOString()
    const sets = [
      { setType: "warmup", weightGrams: 40000, reps: 8 },
      { setType: "working", weightGrams: 60000, reps: 10 },
      { setType: "drop", weightGrams: 40000, reps: 8 },
    ]
    for (const [i, s] of sets.entries()) {
      const res = await api(app, u.token, "PUT", `/workouts/${w.id}/exercises/${ex.id}/sets`, { clientId: randomUUID(), setNumber: i + 1, ...s, completed: true, completedAt: at, updatedAt: at })
      expect(res.status).toBe(200)
    }
    expect((await api(app, u.token, "POST", `/workouts/${w.id}/complete`, {})).status).toBe(200)
    const res = (await api(app, u.token, "GET", "/progress/overview")).json as ProgressOverviewDto
    expect(res.muscleWeeklySets!.find(m => m.muscle === "chest")!.actualSets).toBe(1.5)
  })
})
