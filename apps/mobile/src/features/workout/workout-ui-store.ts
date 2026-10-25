import { create } from "zustand"

export type WorkoutToast =
  | { kind: "undoComplete"; exerciseKey: string; setKey: string; label: string }
  | { kind: "undoSkip"; exerciseKey: string; label: string }
  | { kind: "exerciseDone"; exerciseKey: string; label: string }

interface WorkoutUiState {
  /** Focused exercise (`clientId ?? id`). Null = first exercise with open sets. */
  focusedExerciseKey: string | null
  /** Set shown in the editor. Null = first open set of the focused exercise. */
  selectedSetKey: string | null
  /** Completed set waiting for its RIR answer. */
  rirPendingSetKey: string | null
  /** Unsaved edits of a completed set (saved in one go, so stepping doesn't flood the outbox). */
  editDraft: { setKey: string; weightGrams: number | null; reps: number | null } | null
  toast: (WorkoutToast & { id: number }) | null
  focusExercise: (key: string | null) => void
  selectSet: (key: string | null) => void
  setRirPending: (key: string | null) => void
  setEditDraft: (draft: WorkoutUiState["editDraft"]) => void
  showToast: (toast: WorkoutToast) => void
  hideToast: (id?: number) => void
  reset: () => void
}

let toastId = 0

/** Screen-only state of the active workout (not persisted; the workout itself lives in the active-workout store). */
export const useWorkoutUiStore = create<WorkoutUiState>()(set => ({
  focusedExerciseKey: null,
  selectedSetKey: null,
  rirPendingSetKey: null,
  editDraft: null,
  toast: null,
  focusExercise: key => set({ focusedExerciseKey: key, selectedSetKey: null, editDraft: null }),
  selectSet: key => set({ selectedSetKey: key, editDraft: null }),
  setRirPending: key => set({ rirPendingSetKey: key }),
  setEditDraft: editDraft => set({ editDraft }),
  showToast: toast => set({ toast: { ...toast, id: ++toastId } }),
  hideToast: id => set(s => (id === undefined || s.toast?.id === id ? { toast: null } : {})),
  reset: () => set({ focusedExerciseKey: null, selectedSetKey: null, rirPendingSetKey: null, editDraft: null, toast: null }),
}))
