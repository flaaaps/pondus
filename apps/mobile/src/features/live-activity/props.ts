import type { WeightUnit, WorkoutDto, WorkoutExerciseDto, WorkoutSetDto } from "@pondus/shared"
import type { RestTimerSnapshot } from "@/services/rest-timer-snapshot"
import { formatTimer } from "@/lib/format"
import { elapsedSeconds } from "@/storage/local-reducer"
import {
  effectiveValues,
  focusedExercise,
  formatKg,
  isAssisted,
  isWarmup,
  keyOf,
  numberFor,
  upcomingSet,
  visibleExercises,
  warmupIndexFor,
  type LibraryLookup,
  type Values,
} from "@/features/workout/selectors"

/**
 * Everything the Live Activity shows, already formatted. The widget function runs in the
 * extension's own JS engine without app code, so all logic and wording stays here.
 * Times are epoch milliseconds: props travel as JSON, and the widget turns them into dates.
 */
export interface WorkoutActivityProps {
  workoutKey: string
  status: "running" | "paused" | "done" | "finished"
  /** Big line: exercise name, "Alle Sätze erledigt" or "Workout beendet". */
  title: string
  /** "Übung 2 von 6 · Satz 3 von 4", "Als Nächstes · Übung 3 von 6", "Workout pausiert". */
  progress: string
  /** Narrow variant for the Dynamic Island: "2/6 · Satz 3/4". */
  progressShort: string
  /** Set counter for the compact Dynamic Island: "3/4". */
  setShort: string | null
  /** "80 kg × 8", "−20 kg Unterst. × 8", "12 Wdh." */
  target: string | null
  /** "Zuletzt 80 kg × 8 · RIR 2" */
  last: string | null
  /** Running workout: the counting-up duration starts here. */
  durationStartMs: number | null
  /** Paused or finished workout: frozen duration ("32:10"). */
  durationText: string | null
  /** Running rest; the widget shows "Pause vorbei" once the activity goes stale at `endMs`. */
  rest: { startMs: number; endMs: number } | null
  /** Rest stopped in the app: frozen remaining time ("1:24"). */
  restPausedText: string | null
  /** "Satz ✓" ticks off the set shown (running workout with an open set). */
  canComplete: boolean
  /** Open RIR question of a just completed set; shown instead of the rest buttons while the rest runs. */
  rirPrompt: { setKey: string } | null
}

export interface ActivityInput {
  workout: WorkoutDto
  focusedExerciseKey: string | null
  rirPendingSetKey: string | null
  rest: RestTimerSnapshot
  unit: WeightUnit
  lookup: LibraryLookup
  now: number
}

/** "1:02:03" for an hour or more, else "32:10". */
function formatDurationTimer(seconds: number) {
  const h = Math.floor(seconds / 3600)
  return h > 0 ? `${h}:${formatTimer(seconds % 3600).padStart(5, "0")}` : formatTimer(seconds)
}

function formatValues(v: Values, ex: WorkoutExerciseDto, unit: WeightUnit, lookup: LibraryLookup): string | null {
  if (v.weightGrams === null && v.reps === null) return null
  if (v.weightGrams === null) return `${v.reps} Wdh.`
  const weight = `${formatKg(v.weightGrams, unit)}${isAssisted(ex, lookup) ? " Unterst." : ""}`
  return `${weight} × ${v.reps ?? "–"}`
}

function lastLine(ex: WorkoutExerciseDto, unit: WeightUnit, lookup: LibraryLookup): string | null {
  const done = ex.sets.filter(s => s.completed && !isWarmup(s)).sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""))
  const s = done[done.length - 1]
  const values = s ? formatValues({ weightGrams: s.weightGrams, reps: s.reps }, ex, unit, lookup) : null
  if (!s || !values) return null
  return `Zuletzt ${values}${s.rir !== null ? ` · RIR ${s.rir >= 4 ? "4+" : s.rir}` : ""}`
}

function setLabels(ex: WorkoutExerciseDto, set: WorkoutSetDto) {
  if (isWarmup(set)) {
    const total = ex.sets.filter(isWarmup).length
    const i = warmupIndexFor(ex, set)
    return { long: `Aufwärmen ${i} von ${total}`, short: `Aufw. ${i}/${total}`, counter: `A${i}` }
  }
  const total = ex.sets.filter(s => !isWarmup(s)).length
  const i = numberFor(ex, set)
  return { long: `Satz ${i} von ${total}`, short: `Satz ${i}/${total}`, counter: `${i}/${total}` }
}

function restProps(rest: RestTimerSnapshot, now: number): Pick<WorkoutActivityProps, "rest" | "restPausedText"> {
  if (rest.remainingWhenPaused !== null) return { rest: null, restPausedText: formatTimer(rest.remainingWhenPaused) }
  if (rest.endsAt === null || rest.endsAt <= now) return { rest: null, restPausedText: null }
  // `adjust` moves the end and the duration together, so the start stays where the rest began.
  const startMs = Math.min(now, rest.endsAt - rest.durationSeconds * 1000)
  return { rest: { startMs, endMs: rest.endsAt }, restPausedText: null }
}

/** Props for a running or paused workout. */
export function buildWorkoutActivityProps({ workout: w, focusedExerciseKey, rirPendingSetKey, rest, unit, lookup, now }: ActivityInput): WorkoutActivityProps {
  const elapsed = elapsedSeconds(w, now)
  const paused = w.status === "paused"
  const visible = visibleExercises(w)
  const working = visible.flatMap(e => e.sets).filter(s => !isWarmup(s))
  const base = {
    workoutKey: keyOf(w),
    // Exact, so the props stay identical between changes and the controller can skip updates.
    durationStartMs: paused ? null : new Date(w.startedAt).getTime() + w.pausedSeconds * 1000,
    durationText: paused ? formatDurationTimer(elapsed) : null,
    ...restProps(rest, now),
    canComplete: false,
    rirPrompt: null,
  }
  const focused = focusedExercise(w, focusedExerciseKey)
  const position = (ex: WorkoutExerciseDto) => visible.indexOf(ex) + 1

  if (!focused)
    return { ...base, status: paused ? "paused" : "running", title: w.name, progress: paused ? "Workout pausiert" : "Noch keine Übungen", progressShort: "", setShort: null, target: null, last: null }

  const upcoming = upcomingSet(w, focusedExerciseKey)
  // Same rules as the app: only working sets that were not taken to failure get the question.
  const rirSet = rirPendingSetKey ? visible.flatMap(e => e.sets).find(s => keyOf(s) === rirPendingSetKey) : undefined
  const rirPrompt = !paused && rirSet?.completed && !isWarmup(rirSet) && rirSet.setType !== "failure" ? { setKey: rirPendingSetKey! } : null
  if (!upcoming) {
    const done = working.filter(s => s.completed).length
    return { ...base, status: paused ? "paused" : "done", title: "Alle Sätze erledigt", progress: paused ? "Workout pausiert" : `${done} Arbeitssätze`, progressShort: `${done} Sätze`, setShort: null, target: null, last: lastLine(focused, unit, lookup), rirPrompt }
  }

  const { exercise: current, set, upNext } = upcoming
  const labels = setLabels(current, set)
  const exercisePos = `Übung ${position(current)} von ${visible.length}`
  return {
    ...base,
    status: paused ? "paused" : "running",
    title: current.exerciseNameSnapshot,
    progress: paused ? "Workout pausiert" : upNext ? `Als Nächstes · ${exercisePos}` : `${exercisePos} · ${labels.long}`,
    progressShort: `${position(current)}/${visible.length} · ${labels.short}`,
    setShort: labels.counter,
    target: formatValues(effectiveValues(current, set, lookup), current, unit, lookup),
    last: lastLine(current, unit, lookup),
    canComplete: !paused,
    rirPrompt,
  }
}

/** Final state after "Workout beenden": stays on the Lock Screen for a while. */
export function buildFinishedActivityProps(w: WorkoutDto, now: number): WorkoutActivityProps {
  const sets = visibleExercises(w).flatMap(e => e.sets).filter(s => s.completed && !isWarmup(s)).length
  const seconds = w.durationSeconds ?? elapsedSeconds(w, now)
  return {
    workoutKey: keyOf(w),
    status: "finished",
    title: "Workout beendet",
    progress: `${w.name} · ${sets} Arbeitssätze`,
    progressShort: `${sets} Sätze`,
    setShort: null,
    target: null,
    last: null,
    durationStartMs: null,
    durationText: formatDurationTimer(seconds),
    rest: null,
    restPausedText: null,
    canComplete: false,
    rirPrompt: null,
  }
}

/** The activity should leave the "rest" look at the end of the rest even without an update. */
export const staleDateFor = (p: WorkoutActivityProps) => (p.rest ? new Date(p.rest.endMs) : undefined)
