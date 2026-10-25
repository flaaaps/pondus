import { create } from "zustand"
import type { ExerciseDto } from "@pondus/shared"

/** Transient state for the shared exercise picker modal (plan edits and the active workout). */
interface PickerState {
  title: string
  alternativesFor: string | null
  onPick: ((e: ExerciseDto) => void) | null
  open: (opts: { title: string; alternativesFor?: string; onPick: (e: ExerciseDto) => void }) => void
  pick: (e: ExerciseDto) => void
  close: () => void
}

export const useExercisePicker = create<PickerState>()((set, get) => ({
  title: "Übung wählen",
  alternativesFor: null,
  onPick: null,
  open: ({ title, alternativesFor, onPick }) => set({ title, alternativesFor: alternativesFor ?? null, onPick }),
  pick: e => {
    get().onPick?.(e)
    set({ onPick: null, alternativesFor: null })
  },
  close: () => set({ onPick: null, alternativesFor: null }),
}))
