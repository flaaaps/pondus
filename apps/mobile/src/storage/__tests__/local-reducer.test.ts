import type { WorkoutDto } from "@pondus/shared"
import { applyLocalMutation, elapsedSeconds, mergeLocalDrafts } from "../local-reducer"

const base: WorkoutDto = {
  id: "w1",
  clientId: "w1",
  status: "in_progress",
  name: "Push",
  trainingPlanId: null,
  trainingPlanVersionId: null,
  sourceSessionId: null,
  startedAt: "2026-10-25T10:00:00.000Z",
  completedAt: null,
  pausedAt: null,
  pausedSeconds: 0,
  durationSeconds: null,
  notes: null,
  updatedAt: "2026-10-25T10:00:00.000Z",
  exercises: [
    {
      id: "e1",
      clientId: "e1",
      exerciseId: "bench",
      exerciseNameSnapshot: "Bankdrücken",
      sequence: 1,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      restSeconds: 120,
      targetRir: 2,
      skipped: false,
      notes: null,
      previous: null,
      sets: [
        { id: "s1", clientId: "s1", setNumber: 1, setType: "working", weightGrams: 60000, reps: 10, rir: null, rpe: null, completed: false, completedAt: null, notes: null, targetWeightGrams: 60000, targetReps: 10 },
        { id: "s2", clientId: "s2", setNumber: 2, setType: "working", weightGrams: 60000, reps: 10, rir: null, rpe: null, completed: false, completedAt: null, notes: null, targetWeightGrams: 60000, targetReps: 10 },
      ],
    },
  ],
}
const setBody = (clientId: string, setNumber: number, patch: Partial<{ weightGrams: number | null; reps: number | null; completed: boolean }> = {}) => ({
  clientId,
  setNumber,
  setType: "working" as const,
  weightGrams: 60000,
  reps: 10,
  rir: null,
  rpe: null,
  completed: false,
  completedAt: null,
  notes: null,
  updatedAt: "2026-10-25T10:05:00.000Z",
  ...patch,
})

describe("applyLocalMutation", () => {
  it("completes a set and preserves target hints", () => {
    const next = applyLocalMutation(base, { kind: "upsert_set", workoutClientId: "w1", exerciseClientId: "e1", body: setBody("s1", 1, { weightGrams: 62500, reps: 9, completed: true }) })!
    const s = next.exercises[0]!.sets[0]!
    expect(s.completed).toBe(true)
    expect(s.weightGrams).toBe(62500)
    expect(s.targetWeightGrams).toBe(60000)
    expect(next.exercises[0]!.sets).toHaveLength(2)
  })
  it("adds a new set by clientId and keeps sets ordered", () => {
    const next = applyLocalMutation(base, { kind: "upsert_set", workoutClientId: "w1", exerciseClientId: "e1", body: setBody("s3", 3, { completed: true }) })!
    expect(next.exercises[0]!.sets.map(s => s.setNumber)).toEqual([1, 2, 3])
  })
  it("deletes and renumbers sets", () => {
    const next = applyLocalMutation(base, { kind: "delete_set", workoutClientId: "w1", setClientId: "s1" })!
    expect(next.exercises[0]!.sets.map(s => s.setNumber)).toEqual([1])
  })
  it("adds a replacement exercise right after the replaced one and marks it skipped", () => {
    const next = applyLocalMutation(base, { kind: "add_exercise", workoutClientId: "w1", body: { clientId: "e2", exerciseId: "db-bench", targetSets: 3, replacesWorkoutExerciseId: "e1", sequence: 2 }, exerciseName: "KH-Bankdrücken" } as never)!
    expect(next.exercises.map(e => [e.sequence, e.skipped])).toEqual([
      [1, true],
      [2, false],
    ])
    expect(next.exercises[1]!.exerciseNameSnapshot).toBe("KH-Bankdrücken")
  })
  it("tracks pauses and computes duration without paused time on completion", () => {
    const paused = applyLocalMutation(base, { kind: "pause", workoutClientId: "w1", body: { at: "2026-10-25T10:10:00.000Z" } })!
    expect(paused.status).toBe("paused")
    const resumed = applyLocalMutation(paused, { kind: "resume", workoutClientId: "w1", body: { at: "2026-10-25T10:12:00.000Z" } })!
    expect(resumed.pausedSeconds).toBe(120)
    const withSet = applyLocalMutation(resumed, { kind: "upsert_set", workoutClientId: "w1", exerciseClientId: "e1", body: setBody("s1", 1, { completed: true }) })!
    const done = applyLocalMutation(withSet, { kind: "complete", workoutClientId: "w1", body: { completedAt: "2026-10-25T11:00:00.000Z" } })!
    expect(done.status).toBe("completed")
    expect(done.durationSeconds).toBe(3600 - 120)
    // Untouched placeholder sets are dropped, like on the server.
    expect(done.exercises[0]!.sets).toHaveLength(1)
  })
  it("is idempotent for repeated add_exercise", () => {
    const m = { kind: "add_exercise" as const, workoutClientId: "w1", body: { clientId: "e9", exerciseId: "x", targetSets: 2 } }
    const once = applyLocalMutation(base, m)!
    const twice = applyLocalMutation(once, m)!
    expect(twice.exercises).toHaveLength(2)
  })
  it("stores the workout note of an exercise", () => {
    const next = applyLocalMutation(base, { kind: "update_exercise", workoutClientId: "w1", exerciseClientId: "e1", body: { notes: "Schulter zwickt" } })!
    expect(next.exercises[0]!.notes).toBe("Schulter zwickt")
    expect(next.exercises[0]!.sets).toHaveLength(2)
  })
  it("leaves the workout untouched for a lasting exercise note (it lives outside the workout)", () => {
    const m = { kind: "set_exercise_note" as const, exerciseId: "bench", body: { note: "Sitz 4", updatedAt: "2026-10-25T10:05:00.000Z" } }
    expect(applyLocalMutation(base, m)).toBe(base)
    expect(applyLocalMutation(null, m)).toBeNull()
  })
  it("elapsed excludes an ongoing pause", () => {
    const paused: WorkoutDto = { ...base, status: "paused", pausedAt: "2026-10-25T10:30:00.000Z", pausedSeconds: 60 }
    expect(elapsedSeconds(paused, new Date("2026-10-25T10:45:00.000Z").getTime())).toBe(45 * 60 - 60 - 15 * 60)
  })
})

describe("mergeLocalDrafts", () => {
  const withSets = (sets: WorkoutDto["exercises"][number]["sets"]): WorkoutDto => ({ ...base, exercises: [{ ...base.exercises[0]!, sets }] })
  const [s1, s2] = base.exercises[0]!.sets as [WorkoutDto["exercises"][number]["sets"][number], WorkoutDto["exercises"][number]["sets"][number]]

  it("keeps values typed into open sets when the server copy is adopted", () => {
    const local = withSets([{ ...s1, completed: true, completedAt: "x" }, { ...s2, weightGrams: 80000, reps: 7 }])
    const server = withSets([{ ...s1, completed: true, completedAt: "x" }, { ...s2 }])
    const merged = mergeLocalDrafts(server, local)
    expect(merged.exercises[0]!.sets[1]).toMatchObject({ weightGrams: 80000, reps: 7, completed: false })
  })
  it("never overrides sets the server has completed", () => {
    const local = withSets([{ ...s1, weightGrams: 1000 }, s2])
    const server = withSets([{ ...s1, completed: true, completedAt: "x", weightGrams: 70000 }, s2])
    expect(mergeLocalDrafts(server, local).exercises[0]!.sets[0]!.weightGrams).toBe(70000)
  })
  it("keeps local-only placeholder sets", () => {
    const local = withSets([s1, s2, { ...s2, id: "s3", clientId: "s3", setNumber: 3, weightGrams: 90000 }])
    const merged = mergeLocalDrafts(withSets([s1, s2]), local)
    expect(merged.exercises[0]!.sets.map(s => [s.setNumber, s.weightGrams])).toEqual([
      [1, 60000],
      [2, 60000],
      [3, 90000],
    ])
  })
})
