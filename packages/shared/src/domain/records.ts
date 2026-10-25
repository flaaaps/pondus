import type { PerformedSet } from "./progression"
import type { LoadType } from "./types"
import { COUNTS_AS_WORKING, effectiveLoadGrams } from "./volume"

export const RECORD_TYPES = ["max_weight", "max_reps_at_weight", "max_set_volume", "max_session_volume", "estimated_1rm"] as const
export type RecordType = (typeof RECORD_TYPES)[number]

export const RECORD_LABELS: Record<RecordType, string> = {
  max_weight: "Höchstes Gewicht",
  max_reps_at_weight: "Meiste Wiederholungen bei diesem Gewicht",
  max_set_volume: "Höchstes Satzvolumen",
  max_session_volume: "Höchstes Volumen in einer Einheit",
  estimated_1rm: "Geschätztes 1RM",
}

/**
 * Epley estimate in grams. Only meaningful for ≤ 12 reps; returns null otherwise.
 * Pass the *effective* load: for assisted exercises use `estimateSetOneRepMaxGrams`
 * (assistance is not a load).
 */
export function estimateOneRepMaxGrams(weightGrams: number, reps: number): number | null {
  if (reps <= 0 || reps > 12 || weightGrams <= 0) return null
  if (reps === 1) return weightGrams
  return Math.round(weightGrams * (1 + reps / 30))
}

/** e1RM for a logged set, aware of load type (assisted → body weight − assistance, or null). */
export function estimateSetOneRepMaxGrams(
  weightGrams: number | null,
  reps: number | null,
  loadType?: LoadType,
  bodyweightGrams?: number | null,
): number | null {
  const load = effectiveLoadGrams(weightGrams, loadType, bodyweightGrams)
  if (load === null) return null
  return estimateOneRepMaxGrams(load, reps ?? 0)
}

/** Options for bests/records. `loadType` should always be passed by callers that know it. */
export interface RecordOptions {
  loadType?: LoadType
}

export interface ExerciseBests {
  maxWeightGrams: number
  /** weightGrams → best reps at exactly that weight. */
  repsAtWeight: Record<number, number>
  maxSetVolumeGrams: number
  maxSessionVolumeGrams: number
  estimated1rmGrams: number
}

export interface RecordEvent {
  type: RecordType
  valueGrams: number | null
  reps: number | null
  weightGrams: number | null
  previousValue: number | null
  isEstimate: boolean
}

export function emptyBests(): ExerciseBests {
  return { maxWeightGrams: 0, repsAtWeight: {}, maxSetVolumeGrams: 0, maxSessionVolumeGrams: 0, estimated1rmGrams: 0 }
}

/** True when the bests contain at least one earlier session (i.e. this is not the first training). */
export function hasBestsHistory(bests: ExerciseBests): boolean {
  return bests.maxWeightGrams > 0 || bests.maxSetVolumeGrams > 0 || bests.estimated1rmGrams > 0 || Object.keys(bests.repsAtWeight).length > 0
}

/**
 * Fold a set of performed sets into bests. For `assisted` exercises only reps at a
 * given assistance are tracked: weight, volume and e1RM of the assistance are meaningless
 * (less assistance is better), so those fields stay untouched.
 */
export function accumulateBests(bests: ExerciseBests, sets: PerformedSet[], opts: RecordOptions = {}): ExerciseBests {
  const next: ExerciseBests = { ...bests, repsAtWeight: { ...bests.repsAtWeight } }
  const assisted = opts.loadType === "assisted"
  let sessionVolume = 0
  for (const s of sets) {
    if (!s.completed || !COUNTS_AS_WORKING[s.setType]) continue
    const w = s.weightGrams ?? 0
    const r = s.reps ?? 0
    if (r > (next.repsAtWeight[w] ?? 0)) next.repsAtWeight[w] = r
    if (assisted) continue
    if (w > next.maxWeightGrams && r > 0) next.maxWeightGrams = w
    if (w * r > next.maxSetVolumeGrams) next.maxSetVolumeGrams = w * r
    sessionVolume += w * r
    const e = estimateOneRepMaxGrams(w, r)
    if (e !== null && e > next.estimated1rmGrams) next.estimated1rmGrams = e
  }
  if (sessionVolume > next.maxSessionVolumeGrams) next.maxSessionVolumeGrams = sessionVolume
  return next
}

/**
 * Compare one session's sets of an exercise with the bests *before* that
 * session and list the records set. Comparisons are per exercise so they stay
 * comparable.
 *
 * - The very first session of an exercise (no earlier bests) sets the baseline
 *   and produces **no** records.
 * - `assisted` exercises only get "more reps at the same assistance" records;
 *   max weight / volume / e1RM are skipped because the logged weight is assistance.
 */
export function detectRecords(previous: ExerciseBests, sets: PerformedSet[], opts: RecordOptions = {}): RecordEvent[] {
  const events: RecordEvent[] = []
  const working = sets.filter(s => s.completed && COUNTS_AS_WORKING[s.setType])
  if (!working.length || !hasBestsHistory(previous)) return events
  const assisted = opts.loadType === "assisted"
  const after = accumulateBests(previous, sets, opts)

  if (!assisted && after.maxWeightGrams > previous.maxWeightGrams) {
    const set = working.find(s => (s.weightGrams ?? 0) === after.maxWeightGrams)
    events.push({ type: "max_weight", valueGrams: after.maxWeightGrams, reps: set?.reps ?? null, weightGrams: after.maxWeightGrams, previousValue: previous.maxWeightGrams || null, isEstimate: false })
  }
  for (const s of working) {
    const w = s.weightGrams ?? 0
    const r = s.reps ?? 0
    const prevReps = previous.repsAtWeight[w]
    if (prevReps !== undefined && r > prevReps && !events.some(e => e.type === "max_reps_at_weight" && e.weightGrams === w)) {
      events.push({ type: "max_reps_at_weight", valueGrams: null, reps: r, weightGrams: w, previousValue: prevReps, isEstimate: false })
    }
  }
  if (assisted) return events
  if (after.maxSetVolumeGrams > previous.maxSetVolumeGrams && previous.maxSetVolumeGrams > 0) {
    events.push({ type: "max_set_volume", valueGrams: after.maxSetVolumeGrams, reps: null, weightGrams: null, previousValue: previous.maxSetVolumeGrams, isEstimate: false })
  }
  if (after.maxSessionVolumeGrams > previous.maxSessionVolumeGrams && previous.maxSessionVolumeGrams > 0) {
    events.push({ type: "max_session_volume", valueGrams: after.maxSessionVolumeGrams, reps: null, weightGrams: null, previousValue: previous.maxSessionVolumeGrams, isEstimate: false })
  }
  if (after.estimated1rmGrams > previous.estimated1rmGrams && previous.estimated1rmGrams > 0) {
    events.push({ type: "estimated_1rm", valueGrams: after.estimated1rmGrams, reps: null, weightGrams: null, previousValue: previous.estimated1rmGrams, isEstimate: true })
  }
  return events
}
