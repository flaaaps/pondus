import { create } from "zustand"
import { normalizeExerciseNote, type ExerciseDto } from "@pondus/shared"
import type { ApiClient } from "@/lib/api-client"
import { queryClient } from "@/lib/query-client"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { kv } from "@/storage/db"
import { effectiveNote, patchExerciseNote, queuedNoteIds, settleNotes, type PendingNotes } from "./exercise-notes"

const KEY = "exercise_notes_pending"

interface ExerciseNotesState {
  /** Local edits still in the outbox, by exercise id; they win over the cached server copy. */
  pending: PendingNotes
  hydrate: () => void
  /**
   * Saves (or with null/blank deletes) the lasting note of an exercise. Local-first like the
   * workout: the edit shows at once, is persisted and goes through the outbox (works offline).
   */
  save: (api: ApiClient, exerciseId: string, note: string | null) => void
  /** Moves edits that left the outbox into the query cache (and refetches for the server's word). */
  settle: () => void
  clear: () => void
}

let subscribed = false

export const useExerciseNotesStore = create<ExerciseNotesState>()((set, get) => {
  const write = (pending: PendingNotes) => {
    if (Object.keys(pending).length) kv.set(KEY, pending)
    else kv.delete(KEY)
    set({ pending })
  }
  return {
    pending: {},

    hydrate() {
      set({ pending: kv.get<PendingNotes>(KEY) ?? {} })
      if (!subscribed) {
        subscribed = true
        // The outbox lives in the workout store; whenever its queue changes (and no flush is running), settle what left it.
        useActiveWorkoutStore.subscribe((s, prev) => {
          if (s.sync !== "syncing" && (s.pending !== prev.pending || s.sync !== prev.sync)) get().settle()
        })
      }
      get().settle()
    },

    save(api, exerciseId, note) {
      const value = normalizeExerciseNote(note)
      const updatedAt = new Date().toISOString()
      write({ ...get().pending, [exerciseId]: { note: value, updatedAt } })
      useActiveWorkoutStore.getState().dispatch(api, { kind: "set_exercise_note", exerciseId, body: { note: value, updatedAt } })
    },

    settle() {
      const pending = get().pending
      if (!Object.keys(pending).length) return
      const { keep, settled } = settleNotes(pending, queuedNoteIds(useActiveWorkoutStore.getState().queuedMutations()))
      if (!settled.length) return
      for (const [id, note] of settled) queryClient.setQueriesData({ queryKey: ["exercises"] }, data => (data === undefined ? data : patchExerciseNote(data, id, note)))
      write(keep)
      // Applied edits are already in the cache; a newer note from another device or a rejected edit comes back with the refetch.
      void queryClient.invalidateQueries({ queryKey: ["exercises"] })
    },

    clear() {
      write({})
    },
  }
})

/** The lasting note to show for an exercise: a queued local edit, else the cached server copy. */
export function useEffectiveNote(exerciseId: string | null | undefined, exercise: Pick<ExerciseDto, "note"> | null | undefined): string | null {
  const pending = useExerciseNotesStore(s => (exerciseId ? s.pending[exerciseId] : undefined))
  return effectiveNote(exercise, pending)
}
