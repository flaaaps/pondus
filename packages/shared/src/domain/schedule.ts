import { overlap } from "./muscles"
import type { PlanSessionDraft } from "./types"

/** Default weekday spreads (JS getDay numbering, 0 = Sunday). */
const DEFAULT_SPREAD: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
}

export function defaultWeekdays(frequency: number): number[] {
  return DEFAULT_SPREAD[Math.max(1, Math.min(7, frequency))] ?? DEFAULT_SPREAD[3]!
}

function sessionFatigue(a: PlanSessionDraft, b: PlanSessionDraft): number {
  let total = 0
  for (const ma of a.focusMuscles) for (const mb of b.focusMuscles) total += overlap(ma, mb)
  return total
}

/**
 * Assign sessions to weekdays so that sessions with overlapping muscles are
 * not adjacent when the week allows it. Order of sessions (sequence) is kept
 * when all pairs overlap equally (e.g. full-body plans).
 */
export function assignWeekdays(sessions: PlanSessionDraft[], weekdays?: number[]): PlanSessionDraft[] {
  const days = [...(weekdays && weekdays.length === sessions.length ? weekdays : defaultWeekdays(sessions.length))].sort(
    (a, b) => a - b,
  )
  if (sessions.length <= 2) return sessions.map((s, i) => ({ ...s, weekday: days[i] ?? null }))

  // Greedy: place sessions in sequence order, but if the next session overlaps
  // heavily with the previously placed one and a later session overlaps less,
  // swap them. Keeps the result deterministic and close to the template order.
  const remaining = [...sessions]
  const ordered: PlanSessionDraft[] = []
  while (remaining.length) {
    const prev = ordered[ordered.length - 1]
    let pickIdx = 0
    if (prev) {
      let best = Number.POSITIVE_INFINITY
      remaining.forEach((s, i) => {
        const f = sessionFatigue(prev, s)
        if (f < best - 1e-9) {
          best = f
          pickIdx = i
        }
      })
    }
    ordered.push(remaining.splice(pickIdx, 1)[0]!)
  }
  return ordered.map((s, i) => ({ ...s, sequence: i + 1, weekday: days[i] ?? null }))
}

/** Move one session to another weekday without touching the others. */
export function moveSession(sessions: PlanSessionDraft[], sequence: number, weekday: number | null): PlanSessionDraft[] {
  return sessions.map(s => (s.sequence === sequence ? { ...s, weekday } : s))
}

/** Day offsets for the date of a session in the week containing `reference`. */
export function dateForWeekday(reference: Date, weekday: number, weekOffset = 0): Date {
  const d = new Date(reference)
  const diff = weekday - d.getDay()
  d.setDate(d.getDate() + diff + weekOffset * 7)
  d.setHours(0, 0, 0, 0)
  return d
}
