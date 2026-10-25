import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { api, createTestApp, exerciseIdBySlug, setupOnboardedUser } from "./helpers.js"
import type { App } from "../src/app.js"
import type { ExerciseDto, PlanDto, WorkoutDto } from "@pondus/shared"

let app: App
let close: () => Promise<void>
beforeAll(async () => ({ app, close } = await createTestApp()))
afterAll(() => close())

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

describe("exercise notes", () => {
  it("sets, shows everywhere, trims, deletes and stays per user", async () => {
    const u = await setupOnboardedUser(app)
    const other = await setupOnboardedUser(app)
    const id = await exerciseIdBySlug(app, u.token, "barbell-bench-press")

    const fresh = (await api(app, u.token, "GET", `/exercises/${id}`)).json as ExerciseDto
    expect(fresh.note).toBeNull()
    expect(fresh.noteUpdatedAt).toBeNull()

    const set = await api(app, u.token, "PUT", `/exercises/${id}/note`, { note: "  Bank Stufe 3, Griff eng  " })
    expect(set.status).toBe(200)
    expect((set.json as ExerciseDto).note).toBe("Bank Stufe 3, Griff eng")
    expect((set.json as ExerciseDto).noteUpdatedAt).not.toBeNull()

    // Detail, list and alternatives carry it.
    expect(((await api(app, u.token, "GET", `/exercises/${id}`)).json as ExerciseDto).note).toBe("Bank Stufe 3, Griff eng")
    const list = (await api(app, u.token, "GET", `/exercises?q=bankdrücken&limit=50`)).json as { items: ExerciseDto[] }
    expect(list.items.find(e => e.id === id)?.note).toBe("Bank Stufe 3, Griff eng")

    // Another user does not see it.
    expect(((await api(app, other.token, "GET", `/exercises/${id}`)).json as ExerciseDto).note).toBeNull()

    // The plan-generation preferences replace their rows wholesale; the note survives.
    expect((await api(app, u.token, "PUT", "/me/exercise-preferences", { preferred: [], excluded: [] })).status).toBe(200)
    expect(((await api(app, u.token, "GET", `/exercises/${id}`)).json as ExerciseDto).note).toBe("Bank Stufe 3, Griff eng")

    // Export includes it.
    const exported = (await api(app, u.token, "GET", "/me/export")).json as { exerciseNotes: { exerciseId: string; note: string }[] }
    expect(exported.exerciseNotes).toEqual([expect.objectContaining({ exerciseId: id, note: "Bank Stufe 3, Griff eng" })])

    // Blank = delete; DELETE as well.
    expect(((await api(app, u.token, "PUT", `/exercises/${id}/note`, { note: "   " })).json as ExerciseDto).note).toBeNull()
    await api(app, u.token, "PUT", `/exercises/${id}/note`, { note: "Sitz 4" })
    const deleted = await api(app, u.token, "DELETE", `/exercises/${id}/note`)
    expect(deleted.status).toBe(200)
    expect((deleted.json as ExerciseDto).note).toBeNull()
    expect((deleted.json as ExerciseDto).noteUpdatedAt).not.toBeNull()
  })

  it("validates input and hides other users' custom exercises", async () => {
    const u = await setupOnboardedUser(app)
    const other = await setupOnboardedUser(app)
    const id = await exerciseIdBySlug(app, u.token, "barbell-bench-press")
    expect((await api(app, u.token, "PUT", `/exercises/${id}/note`, { note: "x".repeat(501) })).status).toBe(400)
    expect((await api(app, u.token, "PUT", `/exercises/${id}/note`, {})).status).toBe(400)
    expect((await api(app, u.token, "PUT", `/exercises/${randomUUID()}/note`, { note: "x" })).status).toBe(404)

    const custom = (await api(app, other.token, "POST", "/exercises", { nameDe: "Geheime Maschine", category: "isolation", movementPattern: "squat", equipment: ["machine"], loadType: "machine", primaryMuscles: ["quads"] })).json as ExerciseDto
    expect((await api(app, u.token, "PUT", `/exercises/${custom.id}/note`, { note: "x" })).status).toBe(404)
    expect((await api(app, other.token, "PUT", `/exercises/${custom.id}/note`, { note: "Maschine Nr. 3" })).status).toBe(200)
  })

  it("syncs offline edits through the outbox, newest write wins", async () => {
    const u = await setupOnboardedUser(app)
    const plan = (await api(app, u.token, "POST", "/plans/generate", {})).json as PlanDto
    const exerciseId = plan.currentVersion.sessions[0]!.exercises[0]!.exerciseId
    const workoutClientId = randomUUID()
    const offlineEditAt = minutesAgo(5)

    // A note edited during an offline workout travels in the same batch as the workout mutations.
    const batch = await api(app, u.token, "POST", "/sync/workouts", {
      mutations: [
        { kind: "start_workout", body: { clientId: workoutClientId, source: { type: "empty" } } },
        { kind: "set_exercise_note", exerciseId, body: { note: "Sitz 4", updatedAt: offlineEditAt } },
      ],
    })
    expect(batch.status).toBe(200)
    expect((batch.json as { results: { status: string }[] }).results.map(r => r.status)).toEqual(["applied", "applied"])
    expect(((await api(app, u.token, "GET", `/exercises/${exerciseId}`)).json as ExerciseDto).note).toBe("Sitz 4")

    // Replay of the same mutation: duplicate, nothing changes.
    const replay = await api(app, u.token, "POST", "/sync/workouts", { mutations: [{ kind: "set_exercise_note", exerciseId, body: { note: "Sitz 4", updatedAt: offlineEditAt } }] })
    expect((replay.json as { results: { status: string }[] }).results[0]!.status).toBe("duplicate")

    // Newer edit from another device …
    await api(app, u.token, "PUT", `/exercises/${exerciseId}/note`, { note: "Sitz 5", updatedAt: minutesAgo(1) })
    // … beats an older offline edit (and an older delete) arriving later.
    const stale = await api(app, u.token, "POST", "/sync/workouts", {
      mutations: [
        { kind: "set_exercise_note", exerciseId, body: { note: "Sitz 3", updatedAt: minutesAgo(3) } },
        { kind: "set_exercise_note", exerciseId, body: { note: null, updatedAt: minutesAgo(2) } },
      ],
    })
    expect((stale.json as { results: { status: string }[] }).results.map(r => r.status)).toEqual(["duplicate", "duplicate"])
    expect(((await api(app, u.token, "GET", `/exercises/${exerciseId}`)).json as ExerciseDto).note).toBe("Sitz 5")

    // A delete is a tombstone: an older write cannot bring the note back.
    await api(app, u.token, "PUT", `/exercises/${exerciseId}/note`, { note: null })
    await api(app, u.token, "POST", "/sync/workouts", { mutations: [{ kind: "set_exercise_note", exerciseId, body: { note: "Sitz 2", updatedAt: minutesAgo(1) } }] })
    expect(((await api(app, u.token, "GET", `/exercises/${exerciseId}`)).json as ExerciseDto).note).toBeNull()

    // Unknown exercise → error result (the app drops the entry), the batch goes on.
    const bad = await api(app, u.token, "POST", "/sync/workouts", { mutations: [{ kind: "set_exercise_note", exerciseId: randomUUID(), body: { note: "x", updatedAt: minutesAgo(0) } }] })
    expect((bad.json as { results: { status: string }[] }).results[0]!.status).toBe("error")

    // The workout started in the same batch is unaffected.
    expect(((await api(app, u.token, "GET", "/workouts/active")).json as WorkoutDto).clientId).toBe(workoutClientId)
  })
})
