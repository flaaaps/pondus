import type { WorkoutDto, WorkoutExerciseDto, WorkoutSetDto } from "@pondus/shared"
import type { LibraryLookup } from "@/features/workout/selectors"
import { IDLE_REST_TIMER, type RestTimerSnapshot } from "@/services/rest-timer-snapshot"
import { buildFinishedActivityProps, buildWorkoutActivityProps, staleDateFor, type ActivityInput } from "../props"

const lookup: LibraryLookup = id => (id === "dip" ? { equipment: ["machine"], loadType: "assisted", slug: "assisted-dip" } : id === "pullup" ? { equipment: ["bodyweight"], loadType: "bodyweight", slug: "pull-up" } : { equipment: ["barbell"], loadType: "free_weight", slug: "bench" })

const NOW = Date.parse("2026-10-25T18:00:00Z")
let n = 0
const set = (p: Partial<WorkoutSetDto> = {}): WorkoutSetDto => {
  const id = `s${++n}`
  return { id, clientId: id, setNumber: n, setType: "working", weightGrams: null, reps: null, rir: null, rpe: null, completed: false, completedAt: null, notes: null, targetWeightGrams: null, targetReps: null, ...p }
}
const exercise = (name: string, sets: WorkoutSetDto[], p: Partial<WorkoutExerciseDto> = {}): WorkoutExerciseDto => {
  const id = `e${++n}`
  return { id, clientId: id, exerciseId: "bench", exerciseNameSnapshot: name, sequence: 1, targetSets: sets.length, targetRepsMin: 8, targetRepsMax: 10, restSeconds: 120, targetRir: 2, skipped: false, notes: null, sets, previous: null, ...p }
}
const workout = (exercises: WorkoutExerciseDto[], p: Partial<WorkoutDto> = {}): WorkoutDto => ({
  id: "w1",
  clientId: "w1",
  status: "in_progress",
  name: "Push A",
  trainingPlanId: null,
  trainingPlanVersionId: null,
  sourceSessionId: null,
  startedAt: new Date(NOW - 32 * 60 * 1000).toISOString(),
  completedAt: null,
  pausedAt: null,
  pausedSeconds: 0,
  durationSeconds: null,
  notes: null,
  updatedAt: new Date(NOW).toISOString(),
  exercises,
  ...p,
})
const build = (w: WorkoutDto, p: Partial<ActivityInput> = {}) => buildWorkoutActivityProps({ workout: w, focusedExerciseKey: null, rirPendingSetKey: null, rest: IDLE_REST_TIMER, unit: "kg", lookup, now: NOW, ...p })

describe("buildWorkoutActivityProps", () => {
  it("shows the next open set with target and last set of a running workout", () => {
    const done = set({ weightGrams: 80000, reps: 8, rir: 2, completed: true, completedAt: "2026-10-25T17:50:00Z" })
    const bench = exercise("Bankdrücken", [done, set({ reps: 8 }), set()])
    const p = build(workout([exercise("Kniebeuge", [set({ completed: true })]), bench]))
    expect(p).toMatchObject({
      status: "running",
      title: "Bankdrücken",
      progress: "Übung 2 von 2 · Satz 2 von 3",
      progressShort: "2/2 · Satz 2/3",
      setShort: "2/3",
      target: "80 kg × 8",
      last: "Zuletzt 80 kg × 8 · RIR 2",
      durationStartMs: NOW - 32 * 60 * 1000,
      durationText: null,
      rest: null,
    })
  })
  it("freezes the duration of a paused workout", () => {
    const w = workout([exercise("Bankdrücken", [set()])], { status: "paused", pausedAt: new Date(NOW - 60_000).toISOString(), pausedSeconds: 120 })
    expect(build(w)).toMatchObject({ status: "paused", progress: "Workout pausiert", durationStartMs: null, durationText: "29:00" })
  })
  it("keeps the duration start stable while running, so unchanged props stay equal", () => {
    const w = workout([exercise("Bankdrücken", [set()])], { pausedSeconds: 90 })
    expect(build(w).durationStartMs).toBe(build(w, { now: NOW + 5_000 }).durationStartMs)
    expect(build(w).durationStartMs).toBe(NOW - 32 * 60 * 1000 + 90_000)
  })
  it("carries a running rest with its start and end, and stales at the end", () => {
    const rest: RestTimerSnapshot = { endsAt: NOW + 84_000, durationSeconds: 120, remainingWhenPaused: null, notificationId: null, label: null }
    const p = build(workout([exercise("Bankdrücken", [set()])]), { rest })
    expect(p.rest).toEqual({ startMs: NOW - 36_000, endMs: NOW + 84_000 })
    expect(staleDateFor(p)).toEqual(new Date(NOW + 84_000))
  })
  it("drops a rest that is already over and shows a stopped one as text", () => {
    const over: RestTimerSnapshot = { endsAt: NOW - 1, durationSeconds: 120, remainingWhenPaused: null, notificationId: null, label: null }
    expect(build(workout([exercise("Bankdrücken", [set()])]), { rest: over }).rest).toBeNull()
    const stopped: RestTimerSnapshot = { endsAt: null, durationSeconds: 120, remainingWhenPaused: 84, notificationId: null, label: null }
    expect(build(workout([exercise("Bankdrücken", [set()])]), { rest: stopped })).toMatchObject({ rest: null, restPausedText: "1:24" })
  })
  it("counts warm-ups separately", () => {
    const w = workout([exercise("Bankdrücken", [set({ setType: "warmup", completed: true }), set({ setType: "warmup" }), set({ weightGrams: 100000, reps: 5 })])])
    expect(build(w)).toMatchObject({ progress: "Übung 1 von 1 · Aufwärmen 2 von 2", setShort: "A2" })
  })
  it("points at the next exercise when the focused one is done", () => {
    const squat = exercise("Kniebeuge", [set({ completed: true })])
    const bench = exercise("Bankdrücken", [set({ reps: 8 })])
    expect(build(workout([squat, bench]), { focusedExerciseKey: squat.id })).toMatchObject({ title: "Bankdrücken", progress: "Als Nächstes · Übung 2 von 2", target: "8 Wdh." })
  })
  it("reports when every set is done", () => {
    const w = workout([exercise("Bankdrücken", [set({ weightGrams: 80000, reps: 8, completed: true, completedAt: "t" })])])
    expect(build(w)).toMatchObject({ status: "done", title: "Alle Sätze erledigt", progress: "1 Arbeitssätze", setShort: null, target: null })
  })
  it("handles an empty free workout", () => {
    expect(build(workout([], { name: "Freies Training" }))).toMatchObject({ title: "Freies Training", progress: "Noch keine Übungen", target: null })
  })
  it("ignores skipped exercises in positions", () => {
    const w = workout([exercise("Dips", [set()], { skipped: true }), exercise("Bankdrücken", [set()]), exercise("Rudern", [set()])])
    expect(build(w).progress).toBe("Übung 1 von 2 · Satz 1 von 1")
  })
  it("formats pounds, assistance and bodyweight", () => {
    expect(build(workout([exercise("Bankdrücken", [set({ weightGrams: 45359, reps: 5 })])]), { unit: "lb" }).target).toBe("100 lb × 5")
    expect(build(workout([exercise("Dips", [set({ weightGrams: 20000, reps: 8 })], { exerciseId: "dip" })])).target).toBe("20 kg Unterst. × 8")
    expect(build(workout([exercise("Klimmzug", [set({ reps: 12 })], { exerciseId: "pullup" })])).target).toBe("12 Wdh.")
  })
  it("stays far below the 4 KB limit for ActivityKit content", () => {
    const long = "Schrägbankdrücken mit Kurzhanteln und sehr langem Namen"
    const w = workout(Array.from({ length: 12 }, () => exercise(long, [set({ weightGrams: 80000, reps: 8, rir: 4, completed: true, completedAt: "t" }), set()])))
    const rest: RestTimerSnapshot = { endsAt: NOW + 60_000, durationSeconds: 120, remainingWhenPaused: null, notificationId: null, label: null }
    expect(JSON.stringify(build(w, { rest })).length).toBeLessThan(1024)
  })
})

describe("buttons and RIR question", () => {
  it("offers 'Satz ✓' for a running workout with an open set, not when paused or done", () => {
    expect(build(workout([exercise("Bankdrücken", [set()])])).canComplete).toBe(true)
    expect(build(workout([exercise("Bankdrücken", [set()])], { status: "paused", pausedAt: new Date(NOW).toISOString() })).canComplete).toBe(false)
    expect(build(workout([exercise("Bankdrücken", [set({ completed: true })])])).canComplete).toBe(false)
  })
  it("asks for RIR after a completed working set", () => {
    const s1 = set({ completed: true })
    const w = workout([exercise("Bankdrücken", [s1, set()])])
    expect(build(w, { rirPendingSetKey: s1.id }).rirPrompt).toEqual({ setKey: s1.id })
  })
  it("does not ask after warm-ups, sets to failure, unknown or open sets, or while paused", () => {
    const warm = set({ setType: "warmup", completed: true })
    const failure = set({ setType: "failure", completed: true })
    const open = set()
    const w = workout([exercise("Bankdrücken", [warm, failure, open])])
    expect(build(w, { rirPendingSetKey: warm.id }).rirPrompt).toBeNull()
    expect(build(w, { rirPendingSetKey: failure.id }).rirPrompt).toBeNull()
    expect(build(w, { rirPendingSetKey: open.id }).rirPrompt).toBeNull()
    expect(build(w, { rirPendingSetKey: "missing" }).rirPrompt).toBeNull()
    const done = set({ completed: true })
    const paused = workout([exercise("Bankdrücken", [done])], { status: "paused", pausedAt: new Date(NOW).toISOString() })
    expect(build(paused, { rirPendingSetKey: done.id }).rirPrompt).toBeNull()
  })
  it("keeps the question after the last set, while the final rest runs", () => {
    const last = set({ completed: true })
    expect(build(workout([exercise("Bankdrücken", [last])]), { rirPendingSetKey: last.id })).toMatchObject({ status: "done", rirPrompt: { setKey: last.id } })
  })
})

describe("buildFinishedActivityProps", () => {
  it("summarises the completed workout", () => {
    const w = workout([exercise("Bankdrücken", [set({ completed: true }), set({ completed: true }), set({ setType: "warmup", completed: true })])], { status: "completed", durationSeconds: 52 * 60 })
    expect(buildFinishedActivityProps(w, NOW)).toMatchObject({ status: "finished", title: "Workout beendet", progress: "Push A · 2 Arbeitssätze", durationText: "52:00", rest: null })
  })
})
