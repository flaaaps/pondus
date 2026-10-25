import type { WorkoutDto, WorkoutExerciseDto, WorkoutSetDto } from "@pondus/shared"
import { applyLocalMutation } from "@/storage/local-reducer"
import { canRemove, focusAfterRemoval, originalOf, replacementOf, restorePlan, swapBackPlan } from "../replacement"
import { visibleExercises } from "../selectors"

const set = (id: string, n: number, completed = false): WorkoutSetDto => ({ id, clientId: id, setNumber: n, setType: "working", weightGrams: 50000, reps: 8, rir: null, rpe: null, completed, completedAt: completed ? "2026-10-25T10:05:00.000Z" : null, notes: null, targetWeightGrams: null, targetReps: null })
const ex = (id: string, sequence: number, extra: Partial<WorkoutExerciseDto> = {}): WorkoutExerciseDto => ({
  id: `srv-${id}`,
  clientId: id,
  exerciseId: `lib-${id}`,
  exerciseNameSnapshot: id,
  sequence,
  targetSets: 2,
  targetRepsMin: 8,
  targetRepsMax: 12,
  restSeconds: 120,
  targetRir: 2,
  skipped: false,
  notes: null,
  replacesWorkoutExerciseId: null,
  nextTarget: null,
  previous: null,
  sets: [set(`${id}-1`, 1), set(`${id}-2`, 2)],
  ...extra,
})
const workout = (exercises: WorkoutExerciseDto[]): WorkoutDto => ({ id: "w", clientId: "w", status: "in_progress", name: "Push", trainingPlanId: null, trainingPlanVersionId: null, sourceSessionId: null, startedAt: "2026-10-25T10:00:00.000Z", completedAt: null, pausedAt: null, pausedSeconds: 0, durationSeconds: null, notes: null, updatedAt: "2026-10-25T10:00:00.000Z", exercises })

/** Bench swapped for dumbbell bench: the swap as the reducer produces it from the add_exercise mutation. */
function swapped() {
  const w = workout([ex("bench", 1), ex("row", 2)])
  return applyLocalMutation(w, { kind: "add_exercise", workoutClientId: "w", body: { clientId: "db", exerciseId: "lib-db", targetSets: 2, replacesWorkoutExerciseId: "srv-bench", sequence: 2 }, exerciseName: "db" } as never)!
}

describe("swapping an exercise for today", () => {
  it("links the stand-in to the original by server id, even though the app only knows client ids later", () => {
    const w = swapped()
    const standIn = w.exercises.find(e => e.clientId === "db")!
    const bench = w.exercises[0]!
    expect(bench.skipped).toBe(true)
    expect(w.exercises.map(e => e.sequence)).toEqual([1, 2, 3])
    expect(originalOf(w, standIn)).toBe(bench)
    expect(replacementOf(w, bench)).toBe(standIn)
    expect(originalOf(w, bench)).toBeNull()
  })
  it("resolves the link by client id too (offline-created originals)", () => {
    const w = workout([ex("local", 1, { id: "local", clientId: "local", skipped: true }), ex("db", 2, { replacesWorkoutExerciseId: "local" })])
    expect(originalOf(w, w.exercises[1]!)).toBe(w.exercises[0])
    expect(replacementOf(w, w.exercises[0]!)).toBe(w.exercises[1])
  })
  it("swapping the stand-in again chains: the newest stand-in is the replacement of the one it replaced", () => {
    const once = swapped()
    const twice = applyLocalMutation(once, { kind: "add_exercise", workoutClientId: "w", body: { clientId: "machine", exerciseId: "lib-machine", targetSets: 2, replacesWorkoutExerciseId: "db", sequence: 3 }, exerciseName: "machine" } as never)!
    expect(twice.exercises.map(e => [e.clientId, e.sequence, e.skipped])).toEqual([
      ["bench", 1, true],
      ["db", 2, true],
      ["machine", 3, false],
      ["row", 4, false],
    ])
    const machine = twice.exercises[2]!
    expect(originalOf(twice, machine)?.clientId).toBe("db")
    expect(replacementOf(twice, twice.exercises[1]!)?.clientId).toBe("machine")
  })
})

describe("swapping back", () => {
  it("drops an untouched stand-in and brings the original back", () => {
    const w = swapped()
    const standIn = w.exercises.find(e => e.clientId === "db")!
    const plan = swapBackPlan(w, standIn)!
    expect(plan.restore.clientId).toBe("bench")
    expect(plan.remove).toBe(standIn)
    expect(plan.skip).toBeNull()
    const after = applyLocalMutation(applyLocalMutation(w, { kind: "update_exercise", workoutClientId: "w", exerciseClientId: "bench", body: { skipped: false } })!, { kind: "remove_exercise", workoutClientId: "w", exerciseClientId: "db" })!
    expect(after.exercises.map(e => [e.clientId, e.sequence, e.skipped])).toEqual([
      ["bench", 1, false],
      ["row", 2, false],
    ])
  })
  it("keeps a stand-in with logged sets (skipped) instead of deleting data", () => {
    const w = swapped()
    const standIn = w.exercises.find(e => e.clientId === "db")!
    const logged = { ...w, exercises: w.exercises.map(e => (e === standIn ? { ...e, sets: [set("db-1", 1, true), set("db-2", 2)] } : e)) }
    const plan = swapBackPlan(logged, logged.exercises[1]!)!
    expect(plan.remove).toBeNull()
    expect(plan.skip?.clientId).toBe("db")
    expect(canRemove(logged.exercises[1]!)).toBe(false)
  })
  it("has nothing to swap back to when the original is gone", () => {
    const w = applyLocalMutation(swapped(), { kind: "remove_exercise", workoutClientId: "w", exerciseClientId: "bench" })!
    const standIn = w.exercises.find(e => e.clientId === "db")!
    expect(standIn.replacesWorkoutExerciseId).toBeNull()
    expect(swapBackPlan(w, standIn)).toBeNull()
  })
})

describe("restoring a skipped exercise from the overview", () => {
  it("removes the untouched stand-in so the exercise does not appear twice", () => {
    const w = swapped()
    const plan = restorePlan(w, w.exercises[0]!)
    expect(plan.remove?.clientId).toBe("db")
  })
  it("keeps a stand-in that has logged sets, and a plainly skipped exercise has nothing to remove", () => {
    const w = swapped()
    const withSets = { ...w, exercises: w.exercises.map(e => (e.clientId === "db" ? { ...e, sets: [set("db-1", 1, true)] } : e)) }
    expect(restorePlan(withSets, withSets.exercises[0]!).remove).toBeNull()
    const plain = workout([ex("bench", 1, { skipped: true }), ex("row", 2)])
    expect(restorePlan(plain, plain.exercises[0]!).remove).toBeNull()
  })
})

describe("removing an exercise", () => {
  it("closes the gap in the sequence and moves the focus to the neighbour", () => {
    const w = workout([ex("a", 1), ex("b", 2), ex("c", 3)])
    const visible = visibleExercises(w)
    expect(focusAfterRemoval(visible, visible[1]!)).toBe("c")
    expect(focusAfterRemoval(visible, visible[2]!)).toBe("b")
    expect(focusAfterRemoval([visible[0]!], visible[0]!)).toBeNull()
    const after = applyLocalMutation(w, { kind: "remove_exercise", workoutClientId: "w", exerciseClientId: "b" })!
    expect(after.exercises.map(e => [e.clientId, e.sequence])).toEqual([
      ["a", 1],
      ["c", 2],
    ])
    expect(applyLocalMutation(after, { kind: "remove_exercise", workoutClientId: "w", exerciseClientId: "b" })).toBe(after)
  })
})
