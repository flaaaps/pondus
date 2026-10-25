import type { SetType } from "./types"
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

function topWorkingSets(sets: PerformedSet[]) {
  const working = sets.filter(s => s.completed && COUNTS_AS_WORKING[s.setType] && s.setType !== "drop" && s.setType !== "backoff")
  if (!working.length) return { weight: null as number | null, sets: [] as PerformedSet[] }
  const weight = Math.max(...working.map(s => s.weightGrams ?? 0))
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
): ProgressionRecommendation {
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
  const { weight, sets } = topWorkingSets(last.sets)
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
    const prevTop = prev ? topWorkingSets(prev.sets) : null
    const prevAlsoLow = prevTop && prevTop.weight === weight && prevTop.sets.some(s => (s.reps ?? 0) < target.repsMin)
    if (prevAlsoLow && incrementGrams > 0) {
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
