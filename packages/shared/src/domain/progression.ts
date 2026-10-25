import type { ExerciseRef, LoadType, SetType } from "./types"
import { roundToStep } from "./units"
import { COUNTS_AS_WORKING } from "./volume"

export interface PerformedSet {
  setType: SetType
  weightGrams: number | null
  reps: number | null
  rir: number | null
  completed: boolean
}

export interface PerformanceSnapshot {
  performedAt: string
  sets: PerformedSet[]
}

export interface ProgressionTarget {
  repsMin: number
  repsMax: number
  targetRir: number | null
  targetSets: number
}

export type ProgressionAction = "increase" | "hold" | "add_reps" | "decrease" | "insufficient_data"

export interface ProgressionRecommendation {
  action: ProgressionAction
  /** Suggested load for the next session's working sets, or null when load is not applicable. */
  suggestedWeightGrams: number | null
  /** Suggested rep target inside the range. */
  suggestedReps: number
  lastWeightGrams: number | null
  reason: string
}

/** Default smallest sensible load step by how the exercise is loaded. */
export const DEFAULT_INCREMENT_GRAMS: Record<string, number> = {
  barbell: 2500,
  ez_bar: 2500,
  trap_bar: 2500,
  smith_machine: 2500,
  dumbbell: 2000, // 1 kg per hand → 2 kg pair
  kettlebell: 4000,
  machine: 2500,
  cable: 2500,
  bodyweight: 0,
  plate: 2500,
  resistance_band: 0,
}

/**
 * Smallest sensible load step for an exercise (grams). Bodyweight → 0 (progress via reps);
 * otherwise the largest default step of its equipment (barbell 2.5 kg, dumbbells 2 kg pair …).
 * Assisted exercises use the machine step (assistance goes down by it).
 */
export function incrementForExercise(ex: Pick<ExerciseRef, "loadType" | "equipment">): number {
  if (ex.loadType === "bodyweight") return 0
  const steps = ex.equipment.map(e => DEFAULT_INCREMENT_GRAMS[e] ?? 2500).filter(v => v > 0)
  return steps.length ? Math.max(...steps) : 2500
}

export interface ProgressionOptions {
  /** Load type of the exercise. `assisted` inverts load progression (less assistance = harder). */
  loadType?: LoadType
}

/** Top working sets: heaviest load, or for assisted exercises the *least* assistance. */
function topWorkingSets(sets: PerformedSet[], assisted = false) {
  const working = sets.filter(s => s.completed && COUNTS_AS_WORKING[s.setType] && s.setType !== "drop" && s.setType !== "backoff")
  if (!working.length) return { weight: null as number | null, sets: [] as PerformedSet[] }
  if (assisted) {
    // A missing weight on an assisted set means "assistance not logged", not "0 kg assistance"
    // (which would be the hardest variant). Only sets with a logged assistance count.
    const logged = working.filter(s => s.weightGrams !== null)
    if (!logged.length) return { weight: null as number | null, sets: [] as PerformedSet[] }
    const weight = Math.min(...logged.map(s => s.weightGrams!))
    return { weight, sets: logged.filter(s => s.weightGrams === weight) }
  }
  const weights = working.map(s => s.weightGrams ?? 0)
  const weight = Math.max(...weights)
  return { weight, sets: working.filter(s => (s.weightGrams ?? 0) === weight) }
}

/**
 * Conservative double-progression: reach the top of the rep range on all top
 * sets with RIR at or above target → add the smallest load step; otherwise keep
 * the load and add reps. Two sessions in a row under the bottom of the range →
 * step down. No randomness, no forced changes.
 */
export function recommendProgression(
  target: ProgressionTarget,
  history: PerformanceSnapshot[],
  incrementGrams: number,
  opts: ProgressionOptions = {},
): ProgressionRecommendation {
  const assisted = opts.loadType === "assisted"
  const recent = [...history].sort((a, b) => b.performedAt.localeCompare(a.performedAt))
  const last = recent[0]
  if (!last) {
    return {
      action: "insufficient_data",
      suggestedWeightGrams: null,
      suggestedReps: target.repsMin,
      lastWeightGrams: null,
      reason: "Noch keine Daten für diese Übung. Starte mit einem Gewicht, bei dem du die untere Grenze des Wiederholungsbereichs sicher schaffst.",
    }
  }
  const { weight, sets } = topWorkingSets(last.sets, assisted)
  if (weight === null || sets.length === 0) {
    return {
      action: "insufficient_data",
      suggestedWeightGrams: null,
      suggestedReps: target.repsMin,
      lastWeightGrams: null,
      reason: "Beim letzten Mal wurden keine Arbeitssätze abgeschlossen.",
    }
  }
  const reps = sets.map(s => s.reps ?? 0)
  const minReps = Math.min(...reps)
  const rirOk = sets.every(s => s.rir === null || target.targetRir === null || s.rir >= target.targetRir)
  const enoughSets = sets.length >= Math.max(1, Math.min(target.targetSets, 2))

  if (minReps >= target.repsMax && rirOk && enoughSets) {
    if (assisted && incrementGrams > 0 && weight > 0) {
      const less = Math.max(0, weight - incrementGrams)
      return {
        action: "increase",
        suggestedWeightGrams: less,
        suggestedReps: target.repsMin,
        lastWeightGrams: weight,
        reason: `Alle Sätze am oberen Ende des Bereichs (${target.repsMax} Wdh.). Unterstützung um ${incrementGrams / 1000} kg reduzieren${less === 0 ? " – nächstes Mal ohne Unterstützung" : ""}, zurück auf ${target.repsMin} Wiederholungen.`,
      }
    }
    if (incrementGrams <= 0 || weight === 0) {
      return {
        action: "add_reps",
        suggestedWeightGrams: weight,
        suggestedReps: target.repsMax + 1,
        lastWeightGrams: weight,
        reason: `Du hast ${target.repsMax} Wiederholungen in allen Sätzen geschafft. Ohne Zusatzgewicht: eine Wiederholung mehr oder eine schwerere Variante.`,
      }
    }
    return {
      action: "increase",
      suggestedWeightGrams: weight + incrementGrams,
      suggestedReps: target.repsMin,
      lastWeightGrams: weight,
      reason: `Alle Sätze am oberen Ende des Bereichs (${target.repsMax} Wdh.)${target.targetRir !== null ? " mit Reserve" : ""}. Kleine Steigerung um ${incrementGrams / 1000} kg, zurück auf ${target.repsMin} Wiederholungen.`,
    }
  }

  if (minReps < target.repsMin) {
    const prev = recent[1]
    const prevTop = prev ? topWorkingSets(prev.sets, assisted) : null
    const prevAlsoLow = prevTop && prevTop.weight === weight && prevTop.sets.some(s => (s.reps ?? 0) < target.repsMin)
    if (prevAlsoLow && incrementGrams > 0) {
      if (assisted) {
        const more = weight + incrementGrams
        return {
          action: "decrease",
          suggestedWeightGrams: more,
          suggestedReps: target.repsMin,
          lastWeightGrams: weight,
          reason: `Zweimal in Folge unter ${target.repsMin} Wiederholungen. Etwas mehr Unterstützung (${more / 1000} kg), um wieder sauber im Bereich zu arbeiten.`,
        }
      }
      const stepped = Math.max(0, weight - incrementGrams)
      return {
        action: "decrease",
        suggestedWeightGrams: stepped,
        suggestedReps: target.repsMin,
        lastWeightGrams: weight,
        reason: `Zweimal in Folge unter ${target.repsMin} Wiederholungen. Ein Schritt zurück auf ${stepped / 1000} kg, um wieder sauber im Bereich zu arbeiten.`,
      }
    }
    return {
      action: "hold",
      suggestedWeightGrams: weight,
      suggestedReps: target.repsMin,
      lastWeightGrams: weight,
      reason: `Letztes Mal ${minReps} Wiederholungen, Ziel sind mindestens ${target.repsMin}. Gewicht halten und in den Bereich hineinarbeiten.`,
    }
  }

  return {
    action: "add_reps",
    suggestedWeightGrams: weight,
    suggestedReps: Math.min(target.repsMax, minReps + 1),
    lastWeightGrams: weight,
    reason: rirOk
      ? `Gewicht halten und ${Math.min(target.repsMax, minReps + 1)} Wiederholungen anpeilen. Erst bei ${target.repsMax} in allen Sätzen steigern.`
      : `Die Sätze waren zuletzt sehr nah am Limit. Gewicht halten, bis die Wiederholungen mit Reserve gelingen.`,
  }
}

export type NextTargetKind = "increase_load" | "increase_reps" | "hold" | "deload" | "no_data"

/** Prescription of one exercise in the next workout (from the plan / last workout exercise). */
export interface NextTargetsPrescription {
  repsMin: number
  repsMax: number
  targetRir: number | null
  /** Number of working sets to prefill. */
  targetSets: number
  /** Load step in grams (see `incrementForExercise`); 0 = progress via reps only. */
  incrementGrams: number
  /** Optional rounding step for the suggested weight (e.g. 2500 for plates); defaults to no rounding. */
  roundingStepGrams?: number
}

export interface NextTargets {
  kind: NextTargetKind
  /**
   * Weight for every working set in grams. For `assisted` exercises this is the
   * *assistance* (lower = harder). `null` when there is no usable history.
   */
  weightGrams: number | null
  /** Target reps per working set, length = `targetSets`. */
  repsPerSet: number[]
  targetRir: number | null
  /** Top-set weight of the last session (same semantics as `weightGrams`). */
  lastWeightGrams: number | null
  /** `performedAt` of the session the targets are based on. */
  basedOn: string | null
  /** German one-liner for the UI. */
  reason: string
}

/**
 * Targets for the next session of one exercise (pure, deterministic). Built on
 * `recommendProgression` (double progression: fill the rep range, then add load):
 *
 * - `increase_load`: all top sets hit `repsMax` with RIR ≥ target → weight + increment
 *   (assisted: assistance − increment), every set at `repsMin`.
 * - `increase_reps`: inside the range → same weight, each set one rep more than last time
 *   (capped at `repsMax`, at least `repsMin`). Also used for bodyweight / zero-step
 *   exercises that topped out (then `repsMax + 1`).
 * - `hold`: under `repsMin` once, or sets were closer to failure than `targetRir` →
 *   same weight, repeat last reps (at least `repsMin`).
 * - `deload`: two sessions in a row under `repsMin` at the same weight → one step back
 *   (assisted: more assistance), every set at `repsMin`.
 * - `no_data`: no history or no completed working sets → `weightGrams = null`, reps = `repsMin`.
 *
 * `history` may be in any order; only the latest two sessions matter. Warm-up, drop
 * and back-off sets are ignored.
 */
export function nextTargets(
  prescription: NextTargetsPrescription,
  history: PerformanceSnapshot[],
  opts: ProgressionOptions = {},
): NextTargets {
  const { repsMin, repsMax, targetRir, targetSets, incrementGrams } = prescription
  const assisted = opts.loadType === "assisted"
  const sets = Math.max(1, targetSets)
  const rec = recommendProgression({ repsMin, repsMax, targetRir, targetSets: sets }, history, incrementGrams, opts)
  const last = [...history].sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0]
  const top = last ? topWorkingSets(last.sets, assisted) : { weight: null, sets: [] as PerformedSet[] }
  const lastReps = top.sets.map(s => s.reps ?? 0)
  const fill = (fn: (i: number) => number) => Array.from({ length: sets }, (_, i) => fn(i))
  const round = (w: number | null) => (w === null || !prescription.roundingStepGrams ? w : roundToStep(w, prescription.roundingStepGrams))
  const base = { targetRir, lastWeightGrams: rec.lastWeightGrams, basedOn: last && top.weight !== null ? last.performedAt : null, reason: rec.reason }

  switch (rec.action) {
    case "insufficient_data":
      return { ...base, kind: "no_data", weightGrams: null, repsPerSet: fill(() => repsMin), basedOn: null }
    case "increase":
      return { ...base, kind: "increase_load", weightGrams: round(rec.suggestedWeightGrams), repsPerSet: fill(() => repsMin) }
    case "decrease":
      return { ...base, kind: "deload", weightGrams: round(rec.suggestedWeightGrams), repsPerSet: fill(() => repsMin) }
    case "hold":
      return { ...base, kind: "hold", weightGrams: rec.suggestedWeightGrams, repsPerSet: fill(i => Math.max(repsMin, lastReps[i] ?? repsMin)) }
    case "add_reps": {
      const rirOk = top.sets.every(s => s.rir === null || targetRir === null || s.rir >= targetRir)
      if (!rirOk) {
        return { ...base, kind: "hold", weightGrams: rec.suggestedWeightGrams, repsPerSet: fill(i => Math.min(repsMax, Math.max(repsMin, lastReps[i] ?? repsMin))) }
      }
      // Topped out without a load step (bodyweight): one rep beyond the range.
      if (rec.suggestedReps > repsMax) return { ...base, kind: "increase_reps", weightGrams: rec.suggestedWeightGrams, repsPerSet: fill(() => rec.suggestedReps) }
      const fallback = rec.suggestedReps
      return {
        ...base,
        kind: "increase_reps",
        weightGrams: rec.suggestedWeightGrams,
        repsPerSet: fill(i => {
          const r = lastReps[i]
          return r === undefined ? fallback : Math.min(repsMax, Math.max(repsMin, r + 1))
        }),
      }
    }
  }
}

export interface WarmupStep {
  /** Fraction of the working weight, e.g. 0.6. */
  percent: number
  weightGrams: number
  reps: number
}

/**
 * Warm-up ladder towards a working weight: 40 / 60 / 80 % with 8 / 5 / 3 reps,
 * each rounded with `roundToStep(·, stepGrams)`. Steps that round to ≤ 0, to at
 * least the working weight, below `minWeightGrams` (e.g. empty bar 20 kg → raised to it)
 * or duplicate a previous step are dropped.
 *
 * `opts.sets` picks a shorter ladder (1 → 60 %, 2 → 50 / 80 %), matching a plan's
 * `warmupSets`. Returns [] for working weights ≤ 0 (bodyweight) — do not use for
 * assisted exercises (their weight is assistance).
 */
export function warmupLadder(
  workingWeightGrams: number,
  stepGrams: number,
  opts: { sets?: number; minWeightGrams?: number; percentages?: number[]; reps?: number[] } = {},
): WarmupStep[] {
  if (!(workingWeightGrams > 0)) return []
  const byCount: Record<number, number[]> = { 1: [0.6], 2: [0.5, 0.8], 3: [0.4, 0.6, 0.8] }
  const percentages = opts.percentages ?? byCount[Math.max(1, Math.min(3, opts.sets ?? 3))]!
  const repsFor = (p: number, i: number) => opts.reps?.[i] ?? (p <= 0.45 ? 8 : p <= 0.65 ? 5 : 3)
  const out: WarmupStep[] = []
  percentages.forEach((percent, i) => {
    let w = roundToStep(workingWeightGrams * percent, stepGrams)
    if (opts.minWeightGrams !== undefined) w = Math.max(w, opts.minWeightGrams)
    if (w <= 0 || w >= workingWeightGrams) return
    if (out.some(s => s.weightGrams === w)) return
    out.push({ percent, weightGrams: w, reps: repsFor(percent, i) })
  })
  return out
}
