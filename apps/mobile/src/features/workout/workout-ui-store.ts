import { create } from "zustand"
import { useActiveWorkoutStore } from "./active-workout-store"

export type WorkoutToast =
  | { kind: "undoComplete"; exerciseKey: string; setKey: string; label: string }
  | { kind: "undoSkip"; exerciseKey: string; label: string }
  | { kind: "exerciseDone"; exerciseKey: string; label: string }

interface WorkoutUiState {
  /** Set shown in the editor. Null = first open set of the focused exercise. */
  selectedSetKey: string | null
  /** Unsaved edits of a completed set (saved in one go, so stepping doesn't flood the outbox). */
  editDraft: { setKey: string; weightGrams: number | null; reps: number | null } | null
  toast: (WorkoutToast & { id: number }) | null
  /** Focuses an exercise (persisted in the active-workout store) and starts at its first open set. */
  focusExercise: (key: string | null) => void
  selectSet: (key: string | null) => void
  setEditDraft: (draft: WorkoutUiState["editDraft"]) => void
  showToast: (toast: WorkoutToast) => void
  hideToast: (id?: number) => void
  reset: () => void
}

let toastId = 0

/**
 * Screen-only state of the active workout (not persisted). Focus and the open RIR question live in the
 * active-workout store, because the Live Activity needs them without the screen.
 */
export const useWorkoutUiStore = create<WorkoutUiState>()(set => ({
  selectedSetKey: null,
  editDraft: null,
  toast: null,
  focusExercise: key => {
    useActiveWorkoutStore.getState().focusExercise(key)
    set({ selectedSetKey: null, editDraft: null })
  },
  selectSet: key => set({ selectedSetKey: key, editDraft: null }),
  setEditDraft: editDraft => set({ editDraft }),
  showToast: toast => set({ toast: { ...toast, id: ++toastId } }),
  hideToast: id => set(s => (id === undefined || s.toast?.id === id ? { toast: null } : {})),
  reset: () => set({ selectedSetKey: null, editDraft: null, toast: null }),
}))
