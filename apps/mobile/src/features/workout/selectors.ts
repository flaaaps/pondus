import { DEFAULT_INCREMENT_GRAMS, formatWeight, warmupLadder, type ExerciseDto, type WeightUnit, type WorkoutDto, type WorkoutExerciseDto, type WorkoutSetDto } from "@pondus/shared"

/**
 * Pure helpers for the active workout screen. Everything here derives from the
 * workout DTO plus the exercise library, so it is unit-testable and shared by
 * the focused set editor, the set list, the dock and the overview sheet.
 */

export type LibraryLookup = (exerciseId: string | null) => Pick<ExerciseDto, "equipment" | "loadType" | "slug"> | undefined
export type Values = { weightGrams: number | null; reps: number | null }

/** Stable identity of an exercise or set: `id` changes when the server copy is adopted, `clientId` does not. */
export const keyOf = (x: { id: string; clientId?: string | null }) => x.clientId ?? x.id

export const isWarmup = (s: WorkoutSetDto) => s.setType === "warmup"

/** Smallest sensible load step for the exercise (grams). */
export function stepFor(ex: WorkoutExerciseDto, lookup: LibraryLookup): number {
  const ref = lookup(ex.exerciseId)
  if (!ref) return 2500
  const steps = ref.equipment.map(e => DEFAULT_INCREMENT_GRAMS[e] ?? 2500).filter(v => v > 0)
  return steps.length ? Math.min(...steps) : 2500
}

export const isAssisted = (ex: WorkoutExerciseDto, lookup: LibraryLookup) => lookup(ex.exerciseId)?.loadType === "assisted"
export const isBodyweight = (ex: WorkoutExerciseDto, lookup: LibraryLookup) => lookup(ex.exerciseId)?.loadType === "bodyweight"

/** Working-set number as the lifter counts it (warm-ups don't take a number). 0 for warm-ups. */
export function numberFor(ex: WorkoutExerciseDto, set: WorkoutSetDto): number {
  if (isWarmup(set)) return 0
  return ex.sets.filter(s => !isWarmup(s)).findIndex(s => keyOf(s) === keyOf(set)) + 1
}
/** Position among the warm-ups (1-based). */
export function warmupIndexFor(ex: WorkoutExerciseDto, set: WorkoutSetDto): number {
  return ex.sets.filter(isWarmup).findIndex(s => keyOf(s) === keyOf(set)) + 1
}

/** Last session's value for a working set, matched by working-set index. */
export function previousFor(ex: WorkoutExerciseDto, set: WorkoutSetDto): Values | null {
  if (isWarmup(set)) return null
  const prevWorking = ex.previous?.sets.filter(s => s.setType !== "warmup") ?? []
  const idx = numberFor(ex, set) - 1
  const p = prevWorking[idx] ?? prevWorking[prevWorking.length - 1]
  return p ? { weightGrams: p.weightGrams, reps: p.reps } : null
}

/** The progression target of a working set, when Pondus has one. */
export function targetFor(ex: WorkoutExerciseDto, set: WorkoutSetDto): Values | null {
  if (isWarmup(set) || !ex.nextTarget || ex.nextTarget.kind === "no_data") return null
  if (set.targetWeightGrams === null && set.targetReps === null) return null
  return { weightGrams: set.targetWeightGrams, reps: set.targetReps }
}

/** Working weight the warm-up ladder builds on: today's target, else the first working weight entered. */
export function workingWeightFor(ex: WorkoutExerciseDto): number | null {
  return ex.nextTarget?.weightGrams ?? ex.sets.find(s => !isWarmup(s) && s.weightGrams !== null)?.weightGrams ?? null
}

/** Suggested warm-up for one warm-up row (40/60/80 % ladder), or null when there is nothing to base it on. */
export function warmupSuggestion(ex: WorkoutExerciseDto, set: WorkoutSetDto, lookup: LibraryLookup): (Values & { percent: number; workingWeightGrams: number }) | null {
  if (!isWarmup(set) || isAssisted(ex, lookup)) return null
  const count = ex.sets.filter(isWarmup).length
  const working = workingWeightFor(ex)
  if (!working) return null
  const step = warmupLadder(working, stepFor(ex, lookup), { sets: count })[warmupIndexFor(ex, set) - 1]
  return step ? { weightGrams: step.weightGrams, reps: step.reps, percent: step.percent, workingWeightGrams: working } : null
}

/**
 * The values a set will be saved with, field by field: its own value, else the
 * closest earlier set of the same type that has this field, else the hint
 * (last time). Warm-ups prefer their ladder step over the previous warm-up. Shown in the editor and used when ticking off,
 * so what you see is what gets logged.
 */
export function effectiveValues(ex: WorkoutExerciseDto, set: WorkoutSetDto, lookup: LibraryLookup): Values {
  const idx = ex.sets.findIndex(s => keyOf(s) === keyOf(set))
  const earlier = ex.sets.slice(0, Math.max(0, idx)).reverse().filter(s => s.setType === set.setType)
  const hint = isWarmup(set) ? warmupSuggestion(ex, set, lookup) : previousFor(ex, set)
  // Warm-ups ramp up, so their own ladder step beats the previous warm-up; working sets repeat the set before.
  const pick = (field: keyof Values) => {
    const fromEarlier = earlier.find(s => s[field] !== null)?.[field] ?? null
    return set[field] ?? (isWarmup(set) ? (hint?.[field] ?? fromEarlier) : (fromEarlier ?? hint?.[field] ?? null))
  }
  return { weightGrams: pick("weightGrams"), reps: pick("reps") }
}

/** Patch that ticks a set off with its effective values. */
export function completionPatch(ex: WorkoutExerciseDto, set: WorkoutSetDto, lookup: LibraryLookup, at = new Date().toISOString()): Partial<WorkoutSetDto> {
  const v = effectiveValues(ex, set, lookup)
  return { completed: true, completedAt: at, weightGrams: v.weightGrams, reps: v.reps }
}

/** First open set in list order, or (with `after`) the next open set after that one, wrapping around. */
export function nextOpenSet(ex: WorkoutExerciseDto, after?: WorkoutSetDto): WorkoutSetDto | null {
  const idx = after ? ex.sets.findIndex(s => keyOf(s) === keyOf(after)) : -1
  const order = idx >= 0 ? [...ex.sets.slice(idx + 1), ...ex.sets.slice(0, idx)] : ex.sets
  return order.find(s => !s.completed) ?? null
}

/** Next exercise (after `fromKey`, wrapping around) that still has open sets. */
export function nextExerciseWithOpenSets(visible: WorkoutExerciseDto[], fromKey: string | null): WorkoutExerciseDto | null {
  const start = Math.max(0, visible.findIndex(e => keyOf(e) === fromKey))
  const order = [...visible.slice(start + 1), ...visible.slice(0, start + 1)]
  return order.find(e => e.sets.some(s => !s.completed)) ?? null
}

/** No history yet for this exercise and a rep range to aim for. */
export const isFirstTime = (ex: WorkoutExerciseDto) => !ex.previous && (!ex.nextTarget || ex.nextTarget.kind === "no_data") && ex.targetRepsMin !== null && !ex.sets.some(s => s.completed && !isWarmup(s))

/** Short badge for the progression target: "↑ +2,5 kg", "↑ Wdh.", "= halten", "↓ Deload". */
export function targetBadge(t: WorkoutExerciseDto["nextTarget"], unit: WeightUnit, assisted: boolean): { label: string; tone: "success" | "default" | "warning"; a11y: string } | null {
  if (!t || t.kind === "no_data") return null
  if (t.kind === "increase_load") {
    const diff = t.weightGrams !== null && t.lastWeightGrams !== null ? t.weightGrams - t.lastWeightGrams : null
    const text = diff ? `${diff > 0 ? "+" : "−"}${formatKg(Math.abs(diff), unit)}${assisted ? " Unterst." : ""}` : "mehr Gewicht"
    return { label: `↑ ${text}`, tone: "success", a11y: `Ziel: ${assisted ? "weniger Unterstützung" : "mehr Gewicht"}${diff ? `, ${formatKg(Math.abs(diff), unit)}` : ""}` }
  }
  if (t.kind === "increase_reps") return { label: "↑ Wdh.", tone: "success", a11y: "Ziel: mehr Wiederholungen" }
  if (t.kind === "hold") return { label: "= halten", tone: "default", a11y: "Ziel: Gewicht halten" }
  return { label: "↓ Deload", tone: "warning", a11y: "Ziel: Deload, leichter trainieren" }
}

export const visibleExercises = (w: WorkoutDto) => w.exercises.filter(e => !e.skipped)

/** The exercise in focus: the chosen one, else the first with open sets, else the first. Screen and Live Activity share this. */
export function focusedExercise(w: WorkoutDto, focusedKey: string | null): WorkoutExerciseDto | null {
  const visible = visibleExercises(w)
  return visible.find(e => keyOf(e) === focusedKey) ?? visible.find(e => e.sets.some(s => !s.completed)) ?? visible[0] ?? null
}

/**
 * The set "Satz ✓" acts on: the next open set of the focused exercise, else (focused one done)
 * of the next exercise with open sets. The Live Activity shows and ticks off exactly this set.
 */
export function upcomingSet(w: WorkoutDto, focusedKey: string | null): { exercise: WorkoutExerciseDto; set: WorkoutSetDto; upNext: boolean } | null {
  const focused = focusedExercise(w, focusedKey)
  if (!focused) return null
  const exercise = nextOpenSet(focused) ? focused : nextExerciseWithOpenSets(visibleExercises(w), keyOf(focused))
  const set = exercise ? nextOpenSet(exercise) : null
  return exercise && set ? { exercise, set, upNext: exercise !== focused } : null
}

/** What ticking off a set does; the store applies it, the screen adds haptics, toasts and the delayed advance. */
export interface SetCompletion {
  exercise: WorkoutExerciseDto
  set: WorkoutSetDto
  patch: Partial<WorkoutSetDto>
  /** Rest to start in seconds; null for warm-ups. */
  restSeconds: number | null
  /** Ask how many reps were left (working sets, not to failure). */
  asksRir: boolean
  /** No open sets left in this exercise afterwards. */
  exerciseFinished: boolean
  /** Exercise to carry on with: the same one, the next with open sets, or null when everything is done. */
  next: WorkoutExerciseDto | null
}

export function planCompletion(w: WorkoutDto, exerciseKey: string, setKey: string, lookup: LibraryLookup, defaultRestSeconds: number, at = new Date().toISOString()): SetCompletion | null {
  const exercise = w.exercises.find(e => keyOf(e) === exerciseKey)
  const set = exercise?.sets.find(s => keyOf(s) === setKey)
  if (!exercise || !set || set.completed) return null
  const patch = completionPatch(exercise, set, lookup, at)
  const exerciseFinished = exercise.sets.every(s => s.completed || keyOf(s) === setKey)
  // Look ahead with this set already done, so the last set of the last open exercise leads nowhere.
  const after = visibleExercises(w).map(e => (e === exercise ? { ...e, sets: e.sets.map(s => (s === set ? { ...s, completed: true } : s)) } : e))
  const next = exerciseFinished ? nextExerciseWithOpenSets(after, exerciseKey) : exercise
  return {
    exercise,
    set,
    patch,
    restSeconds: isWarmup(set) ? null : (exercise.restSeconds ?? defaultRestSeconds),
    asksRir: !isWarmup(set) && set.setType !== "failure",
    exerciseFinished,
    next: next ? (w.exercises.find(e => keyOf(e) === keyOf(next)) ?? null) : null,
  }
}

export type ScreenState = "empty" | "paused" | "ready" | "editingDone" | "exerciseDone" | "workoutDone"

/** What the focused screen shows, from the workout plus the focus/selection. */
export function deriveScreenState(w: WorkoutDto, focused: WorkoutExerciseDto | null, selected: WorkoutSetDto | null): ScreenState {
  if (w.status === "paused") return "paused"
  const visible = visibleExercises(w)
  if (!visible.length || !focused) return "empty"
  if (selected?.completed) return "editingDone"
  if (selected) return "ready"
  if (visible.some(e => e.sets.some(s => !s.completed))) return "exerciseDone"
  return "workoutDone"
}

/** Weight with a German decimal comma: "82,5 kg". */
export const formatKg = (grams: number | null, unit: WeightUnit, withUnit = true) => (grams === null ? "–" : formatWeight(grams, unit, { withUnit }).replace(".", ","))

/** "82,5 × 8" (weight without unit), "– × 8" when empty. */
export const formatSet = (v: Values, unit: WeightUnit) => `${formatKg(v.weightGrams, unit, false)} × ${v.reps ?? "–"}`
