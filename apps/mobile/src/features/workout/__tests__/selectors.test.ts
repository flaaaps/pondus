import type { WorkoutDto, WorkoutExerciseDto, WorkoutSetDto } from "@pondus/shared"
import { completionPatch, deriveScreenState, effectiveValues, focusedExercise, keyOf, nextExerciseWithOpenSets, numberFor, planCompletion, warmupSuggestion, type LibraryLookup } from "../selectors"

const lookup: LibraryLookup = () => ({ equipment: ["barbell"], loadType: "free_weight", slug: "barbell-bench-press" })

let n = 0
const set = (p: Partial<WorkoutSetDto> = {}): WorkoutSetDto => {
  const id = `s${++n}`
  return { id, clientId: id, setNumber: n, setType: "working", weightGrams: null, reps: null, rir: null, rpe: null, completed: false, completedAt: null, notes: null, targetWeightGrams: null, targetReps: null, ...p }
}
const exercise = (sets: WorkoutSetDto[], p: Partial<WorkoutExerciseDto> = {}): WorkoutExerciseDto => ({
  id: `e${++n}`,
  clientId: null,
  exerciseId: "bench",
  exerciseNameSnapshot: "Bankdrücken",
  sequence: 1,
  targetSets: 3,
  targetRepsMin: 6,
  targetRepsMax: 10,
  restSeconds: 120,
  targetRir: 2,
  skipped: false,
  notes: null,
  sets,
  previous: null,
  ...p,
})

describe("effectiveValues", () => {
  it("fills each field separately from the closest earlier set (reps prefilled, weight empty)", () => {
    const s1 = set({ weightGrams: 60000, reps: 8, completed: true })
    const s2 = set({ reps: 8 })
    const s3 = set({ reps: 8 })
    const ex = exercise([s1, s2, s3])
    expect(effectiveValues(ex, s3, lookup)).toEqual({ weightGrams: 60000, reps: 8 })
    expect(completionPatch(ex, s3, lookup, "t")).toEqual({ completed: true, completedAt: "t", weightGrams: 60000, reps: 8 })
  })
  it("falls back to last time's value for working sets", () => {
    const s1 = set({ reps: 8 })
    const ex = exercise([s1], { previous: { performedAt: "2026-10-20", sets: [{ setType: "working", weightGrams: 70000, reps: 7, rir: null }] } as WorkoutExerciseDto["previous"] })
    expect(effectiveValues(ex, s1, lookup)).toEqual({ weightGrams: 70000, reps: 8 })
  })
  it("uses the warm-up ladder for warm-ups, based on the first working weight", () => {
    const w1 = set({ setType: "warmup" })
    const w2 = set({ setType: "warmup" })
    const s1 = set({ weightGrams: 100000, reps: 8 })
    const ex = exercise([w1, w2, s1])
    expect(warmupSuggestion(ex, w1, lookup)).toMatchObject({ percent: 0.5, weightGrams: 50000 })
    expect(effectiveValues(ex, w1, lookup).weightGrams).toBe(50000)
    expect(effectiveValues(ex, w2, lookup).weightGrams).toBeGreaterThan(50000)
    // A completed first warm-up must not override the second one's own ladder step.
    const ex2 = exercise([{ ...w1, weightGrams: 50000, reps: 5, completed: true }, w2, s1])
    expect(effectiveValues(ex2, w2, lookup)).toEqual({ weightGrams: warmupSuggestion(ex2, w2, lookup)!.weightGrams, reps: warmupSuggestion(ex2, w2, lookup)!.reps })
  })
  it("has no warm-up suggestion without a working weight", () => {
    const w1 = set({ setType: "warmup" })
    const ex = exercise([w1, set()])
    expect(warmupSuggestion(ex, w1, lookup)).toBeNull()
    expect(effectiveValues(ex, w1, lookup)).toEqual({ weightGrams: null, reps: null })
  })
})

describe("numbering and navigation", () => {
  it("numbers working sets without warm-ups", () => {
    const w1 = set({ setType: "warmup" })
    const s1 = set()
    const s2 = set()
    const ex = exercise([w1, s1, s2])
    expect(numberFor(ex, w1)).toBe(0)
    expect(numberFor(ex, s2)).toBe(2)
  })
  it("finds the next exercise with open sets, wrapping around", () => {
    const a = exercise([set({ completed: true })])
    const b = exercise([set({ completed: true })])
    const c = exercise([set()])
    expect(keyOf(nextExerciseWithOpenSets([a, b, c], keyOf(a))!)).toBe(keyOf(c))
    expect(keyOf(nextExerciseWithOpenSets([c, a, b], keyOf(b))!)).toBe(keyOf(c))
    expect(nextExerciseWithOpenSets([a, b], keyOf(a))).toBeNull()
  })
})

describe("deriveScreenState", () => {
  const w = (exercises: WorkoutExerciseDto[], status: WorkoutDto["status"] = "in_progress") => ({ status, exercises }) as WorkoutDto
  it("covers the main states", () => {
    const open = set()
    const done = set({ completed: true })
    const ex = exercise([done, open])
    expect(deriveScreenState(w([ex]), ex, open)).toBe("ready")
    expect(deriveScreenState(w([ex]), ex, done)).toBe("editingDone")
    expect(deriveScreenState(w([ex], "paused"), ex, open)).toBe("paused")
    const finished = exercise([set({ completed: true })])
    expect(deriveScreenState(w([finished, ex]), finished, null)).toBe("exerciseDone")
    expect(deriveScreenState(w([finished]), finished, null)).toBe("workoutDone")
    expect(deriveScreenState(w([]), null, null)).toBe("empty")
  })
})

describe("focusedExercise", () => {
  const w = (exercises: WorkoutExerciseDto[]) => ({ status: "in_progress", exercises }) as WorkoutDto
  it("uses the chosen exercise, else the first with open sets, else the first", () => {
    const done = exercise([set({ completed: true })])
    const open = exercise([set()])
    expect(focusedExercise(w([done, open]), keyOf(done))).toBe(done)
    expect(focusedExercise(w([done, open]), null)).toBe(open)
    expect(focusedExercise(w([done]), null)).toBe(done)
    expect(focusedExercise(w([]), null)).toBeNull()
  })
  it("ignores a skipped exercise in focus", () => {
    const skipped = exercise([set()], { skipped: true })
    const open = exercise([set()])
    expect(focusedExercise(w([skipped, open]), keyOf(skipped))).toBe(open)
  })
})

describe("planCompletion", () => {
  const w = (exercises: WorkoutExerciseDto[]) => ({ status: "in_progress", exercises }) as WorkoutDto
  it("logs a working set with its effective values, rests and asks for RIR", () => {
    const s1 = set({ weightGrams: 80000, reps: 8, completed: true })
    const s2 = set({ reps: 8 })
    const s3 = set({ reps: 8 })
    const ex = exercise([s1, s2, s3], { restSeconds: 150 })
    const plan = planCompletion(w([ex]), keyOf(ex), keyOf(s2), lookup, 90, "t")!
    expect(plan.patch).toEqual({ completed: true, completedAt: "t", weightGrams: 80000, reps: 8 })
    expect(plan.restSeconds).toBe(150)
    expect(plan.asksRir).toBe(true)
    expect(plan.exerciseFinished).toBe(false)
    expect(plan.next).toBe(ex)
  })
  it("falls back to the default rest", () => {
    const s1 = set()
    const ex = exercise([s1, set()], { restSeconds: null })
    expect(planCompletion(w([ex]), keyOf(ex), keyOf(s1), lookup, 90)!.restSeconds).toBe(90)
  })
  it("has no rest and no RIR question for warm-ups", () => {
    const w1 = set({ setType: "warmup" })
    const ex = exercise([w1, set({ weightGrams: 100000, reps: 5 })])
    const plan = planCompletion(w([ex]), keyOf(ex), keyOf(w1), lookup, 90)!
    expect(plan.restSeconds).toBeNull()
    expect(plan.asksRir).toBe(false)
  })
  it("does not ask for RIR after a set to failure", () => {
    const f = set({ setType: "failure" })
    const ex = exercise([f])
    expect(planCompletion(w([ex]), keyOf(ex), keyOf(f), lookup, 90)!.asksRir).toBe(false)
  })
  it("moves on to the next exercise with open sets after the last set", () => {
    const last = set()
    const a = exercise([set({ completed: true }), last])
    const b = exercise([set()])
    const plan = planCompletion(w([a, b]), keyOf(a), keyOf(last), lookup, 90)!
    expect(plan.exerciseFinished).toBe(true)
    expect(plan.next).toBe(b)
  })
  it("leads nowhere after the very last open set", () => {
    const last = set()
    const a = exercise([set({ completed: true }), last])
    const b = exercise([set({ completed: true })])
    const skipped = exercise([set()], { skipped: true })
    expect(planCompletion(w([a, b, skipped]), keyOf(a), keyOf(last), lookup, 90)!.next).toBeNull()
  })
  it("returns null for unknown or already completed sets", () => {
    const done = set({ completed: true })
    const ex = exercise([done])
    expect(planCompletion(w([ex]), keyOf(ex), keyOf(done), lookup, 90)).toBeNull()
    expect(planCompletion(w([ex]), keyOf(ex), "missing", lookup, 90)).toBeNull()
  })
})
