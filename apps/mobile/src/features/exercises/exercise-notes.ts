import type { ExerciseDto, SyncMutation } from "@pondus/shared"

/** A note edit that is queued in the outbox but not yet confirmed by the server. */
export interface PendingNote {
  note: string | null
  updatedAt: string
}
export type PendingNotes = Record<string, PendingNote>

/**
 * The note to show: a queued local edit wins over the (possibly stale or cached) server copy.
 * `note` may be missing on exercises cached before notes existed.
 */
export function effectiveNote(exercise: Pick<ExerciseDto, "note"> | null | undefined, pending: PendingNote | undefined): string | null {
  if (pending) return pending.note
  return exercise?.note ?? null
}

/** Exercise ids that still have a note edit waiting in the outbox. */
export function queuedNoteIds(mutations: SyncMutation[]): Set<string> {
  return new Set(mutations.flatMap(m => (m.kind === "set_exercise_note" ? [m.exerciseId] : [])))
}

/**
 * Splits the pending edits after a flush: those still queued stay pending; the rest left the
 * queue (applied, superseded by a newer server note, or rejected) and are settled.
 */
export function settleNotes(pending: PendingNotes, queued: Set<string>): { keep: PendingNotes; settled: [string, PendingNote][] } {
  const keep: PendingNotes = {}
  const settled: [string, PendingNote][] = []
  for (const [id, p] of Object.entries(pending)) {
    if (queued.has(id)) keep[id] = p
    else settled.push([id, p])
  }
  return { keep, settled }
}

type NoteFields = Pick<ExerciseDto, "id" | "note" | "noteUpdatedAt">
const isExercise = (v: unknown): v is NoteFields => !!v && typeof v === "object" && "id" in v && "slug" in v && "nameDe" in v

/**
 * Writes a note into any cached exercise shape (detail, full list, infinite pages, alternatives)
 * so every screen shows it without a refetch. Returns the same reference when nothing changed.
 */
export function patchExerciseNote<T>(data: T, exerciseId: string, note: PendingNote): T {
  const patch = (e: NoteFields) => (e.id === exerciseId ? { ...e, note: note.note, noteUpdatedAt: note.updatedAt } : e)
  const walk = (v: unknown): unknown => {
    if (isExercise(v)) return patch(v)
    if (Array.isArray(v)) {
      const next = v.map(walk)
      return next.some((x, i) => x !== v[i]) ? next : v
    }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>
      for (const key of ["items", "pages", "exercise"] as const) {
        if (!(key in o)) continue
        const next = walk(o[key])
        if (next !== o[key]) return { ...o, [key]: next }
      }
    }
    return v
  }
  return walk(data) as T
}
