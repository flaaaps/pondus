import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { api, createTestApp, exerciseIdBySlug, registerUser, setupOnboardedUser } from "./helpers.js"
import type { App } from "../src/app.js"
import type { PlanDto, AdjustmentPreviewDto, PlanWeekDto } from "@pondus/shared"

let app: App
let close: () => Promise<void>
beforeAll(async () => ({ app, close } = await createTestApp()))
afterAll(() => close())

describe("exercise library", () => {
  it("is seeded with ≥150 exercises and supports search and filters", async () => {
    const u = await registerUser(app)
    const all = await api(app, u.token, "GET", "/exercises?limit=100")
    expect(all.status).toBe(200)
    expect((all.json as { total: number }).total).toBeGreaterThanOrEqual(150)
    const chest = await api(app, u.token, "GET", "/exercises?muscles=chest&equipment=dumbbell,bench&limit=50")
    const items = (chest.json as { items: { primaryMuscles: string[]; equipment: string[] }[] }).items
    expect(items.length).toBeGreaterThan(2)
    // Equipment filter is OR: any selected item matches.
    for (const e of items) expect(e.equipment.some(x => ["dumbbell", "bench"].includes(x))).toBe(true)
    const search = await api(app, u.token, "GET", "/exercises?q=bank")
    expect((search.json as { items: unknown[] }).items.length).toBeGreaterThan(3)
  })

  it("supports favorites, custom exercises and alternatives, isolated per user", async () => {
    const a = await registerUser(app)
    const b = await registerUser(app)
    const created = await api(app, a.token, "POST", "/exercises", { nameDe: "Meine Spezialübung", category: "isolation", movementPattern: "elbow_flexion", equipment: ["dumbbell"], loadType: "free_weight", primaryMuscles: ["biceps"] })
    expect(created.status).toBe(201)
    const id = (created.json as { id: string }).id
    expect((await api(app, b.token, "GET", `/exercises/${id}`)).status).toBe(404)
    expect((await api(app, b.token, "PATCH", `/exercises/${id}`, { nameDe: "Hack" })).status).toBe(404)
    const fav = await api(app, a.token, "PUT", `/exercises/${id}/favorite`)
    expect((fav.json as { isFavorite: boolean }).isFavorite).toBe(true)
    const favs = await api(app, a.token, "GET", "/exercises?favorites=true")
    expect((favs.json as { items: { id: string }[] }).items.map(i => i.id)).toEqual([id])
    const bench = await exerciseIdBySlug(app, a.token, "barbell-bench-press")
    const alts = await api(app, a.token, "GET", `/exercises/${bench}/alternatives`)
    expect(alts.status).toBe(200)
    const list = alts.json as { exercise: { slug: string; primaryMuscles: string[] }; reasons: string[] }[]
    expect(list.length).toBeGreaterThan(3)
    for (const x of list) expect(x.exercise.primaryMuscles).toContain("chest")
    expect(list[0]!.reasons).toContain("Empfohlene Alternative")
    expect((await api(app, a.token, "DELETE", `/exercises/${id}`)).status).toBe(204)
    expect((await api(app, a.token, "GET", `/exercises/${id}`)).status).toBe(404)
  })
})

describe("training plans", () => {
  it("generates a plan from the profile, lists the week, edits via versions and adjusts frequency with preview", async () => {
    const u = await setupOnboardedUser(app, { weeklyFrequency: 4 })
    const squat = await exerciseIdBySlug(app, u.token, "barbell-back-squat")
    const prefs = await api(app, u.token, "PUT", "/me/exercise-preferences", { preferred: [], excluded: [squat] })
    expect(prefs.status).toBe(200)

    const gen = await api(app, u.token, "POST", "/plans/generate", {})
    expect(gen.status).toBe(201)
    const plan = gen.json as PlanDto
    expect(plan.status).toBe("active")
    expect(plan.currentVersion.sessions).toHaveLength(4)
    expect(plan.currentVersion.splitType).toBe("upper_lower")
    expect(plan.currentVersion.sessions.flatMap(s => s.exercises).some(e => e.exerciseId === squat)).toBe(false)
    expect(plan.currentVersion.rationale.length).toBeGreaterThan(2)

    const week = await api(app, u.token, "GET", "/plans/week")
    const weekDto = week.json as PlanWeekDto
    expect(weekDto.sessions).toHaveLength(4)
    expect(weekDto.sessions.every(s => s.date !== null)).toBe(true)
    expect(weekDto.nextSessionId).not.toBeNull()

    // Move one session to Saturday of this week only.
    const first = weekDto.sessions[0]!
    const saturday = weekDto.weekEnd.replace(/\d{2}$/, m => String(Number(m) - 1).padStart(2, "0"))
    const moved = await api(app, u.token, "POST", `/plans/sessions/${first.planSessionId}/override`, { weekStart: weekDto.weekStart, action: "move", date: saturday })
    expect(moved.status).toBe(200)
    expect((moved.json as PlanWeekDto).sessions.find(s => s.planSessionId === first.planSessionId)!.date).toBe(saturday)
    // Template unchanged.
    const again = await api(app, u.token, "GET", `/plans/${plan.id}`)
    expect((again.json as PlanDto).currentVersion.versionNumber).toBe(1)

    // Edit: swap first exercise, change sets → version 2, version 1 still readable.
    const session = plan.currentVersion.sessions[0]!
    const target = session.exercises[0]!
    const alts = await api(app, u.token, "GET", `/exercises/${target.exerciseId}/alternatives`)
    const alt = (alts.json as { exercise: { id: string } }[])[0]!.exercise.id
    const edited = await api(app, u.token, "POST", `/plans/${plan.id}/edit`, {
      ops: [
        { op: "swap_exercise", planExerciseId: target.id, newExerciseId: alt },
        { op: "update_exercise", planExerciseId: session.exercises[1]!.id, params: { targetSets: 5 } },
        { op: "move_session", sessionId: session.id, weekday: 0 },
      ],
    })
    expect(edited.status).toBe(200)
    const v2 = (edited.json as PlanDto).currentVersion
    expect(v2.versionNumber).toBe(2)
    expect(v2.sessions[0]!.exercises[0]!.exerciseId).toBe(alt)
    expect(v2.sessions[0]!.exercises[1]!.targetSets).toBe(5)
    expect(v2.sessions[0]!.weekday).toBe(0)
    const v1 = await api(app, u.token, "GET", `/plans/${plan.id}/versions/1`)
    expect(v1.status).toBe(200)
    expect((v1.json as { sessions: { exercises: { exerciseId: string }[] }[] }).sessions[0]!.exercises[0]!.exerciseId).toBe(target.exerciseId)

    // Frequency 4 → 3 with preview and apply.
    const preview = await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/preview`, { weeklyFrequency: 3 })
    expect(preview.status).toBe(200)
    const p = preview.json as AdjustmentPreviewDto
    expect(p.proposal.sessions).toHaveLength(3)
    expect(p.diff.newFrequency).toBe(3)
    expect(p.diff.exercisesKept).toBeGreaterThan(3)
    expect(p.diff.summary.length).toBeGreaterThan(0)
    const applied = await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/apply`, { previewId: p.previewId })
    expect(applied.status).toBe(200)
    expect((applied.json as PlanDto).currentVersion.versionNumber).toBe(3)
    expect((applied.json as PlanDto).currentVersion.sessions).toHaveLength(3)
    const profile = await api(app, u.token, "GET", "/me/profile")
    expect((profile.json as { weeklyFrequency: number }).weeklyFrequency).toBe(3)
    // Preview is single-use.
    expect((await api(app, u.token, "POST", `/plans/${plan.id}/adjustments/apply`, { previewId: p.previewId })).status).toBe(409)
  })

  it("isolates plans between users", async () => {
    const a = await setupOnboardedUser(app)
    const b = await setupOnboardedUser(app)
    const plan = (await api(app, a.token, "POST", "/plans/generate", {})).json as PlanDto
    expect((await api(app, b.token, "GET", `/plans/${plan.id}`)).status).toBe(404)
    expect((await api(app, b.token, "POST", `/plans/${plan.id}/edit`, { ops: [{ op: "rename_plan", name: "pwned" }] })).status).toBe(404)
    expect((await api(app, b.token, "GET", `/plans/sessions/${plan.currentVersion.sessions[0]!.id}`)).status).toBe(404)
  })
})
