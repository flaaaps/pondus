import type { PerformedSet } from "./progression"
import { COUNTS_AS_WORKING } from "./volume"

export const RECORD_TYPES = ["max_weight", "max_reps_at_weight", "max_set_volume", "max_session_volume", "estimated_1rm"] as const
export type RecordType = (typeof RECORD_TYPES)[number]

export const RECORD_LABELS: Record<RecordType, string> = {
  max_weight: "Höchstes Gewicht",
  max_reps_at_weight: "Meiste Wiederholungen bei diesem Gewicht",
  max_set_volume: "Höchstes Satzvolumen",
  max_session_volume: "Höchstes Volumen in einer Einheit",
  estimated_1rm: "Geschätztes 1RM",
}

/** Epley estimate in grams. Only meaningful for ≤ 12 reps; returns null otherwise. */
export function estimateOneRepMaxGrams(weightGrams: number, reps: number): number | null {
  if (reps <= 0 || reps > 12 || weightGrams <= 0) return null
  if (reps === 1) return weightGrams
  return Math.round(weightGrams * (1 + reps / 30))
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

/** Fold a set of performed sets into bests. */
export function accumulateBests(bests: ExerciseBests, sets: PerformedSet[]): ExerciseBests {
  const next: ExerciseBests = { ...bests, repsAtWeight: { ...bests.repsAtWeight } }
  let sessionVolume = 0
  for (const s of sets) {
    if (!s.completed || !COUNTS_AS_WORKING[s.setType]) continue
    const w = s.weightGrams ?? 0
    const r = s.reps ?? 0
    if (w > next.maxWeightGrams && r > 0) next.maxWeightGrams = w
    if (r > (next.repsAtWeight[w] ?? 0)) next.repsAtWeight[w] = r
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
 * session and list the records set. Only working sets with weight > 0 or
 * bodyweight reps are considered; comparisons are per exercise so they stay
 * comparable.
 */
export function detectRecords(previous: ExerciseBests, sets: PerformedSet[]): RecordEvent[] {
  const events: RecordEvent[] = []
  const after = accumulateBests(previous, sets)
  const working = sets.filter(s => s.completed && COUNTS_AS_WORKING[s.setType])
  if (!working.length) return events

  if (after.maxWeightGrams > previous.maxWeightGrams && previous.maxWeightGrams >= 0) {
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
