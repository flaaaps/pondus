import { create } from "zustand"
import type { Equipment, ExperienceLevel, Goal, MuscleSlug, TrainingEnvironment } from "@pondus/shared"
import { ENVIRONMENT_EQUIPMENT } from "@pondus/shared"

/** In-memory onboarding answers; persisted to the server in the summary step. */
export interface OnboardingDraft {
  goals: Goal[]
  experienceLevel: ExperienceLevel
  weeklyFrequency: number
  sessionDurationMinutes: number
  environment: TrainingEnvironment
  availableEquipment: Equipment[]
  focusMuscles: MuscleSlug[]
  preferred: string[]
  excluded: string[]
  preferredWeekdays: number[]
}

interface DraftState extends OnboardingDraft {
  update: (patch: Partial<OnboardingDraft>) => void
  toggleGoal: (g: Goal) => void
  toggleFocus: (m: MuscleSlug) => void
  moveFocus: (m: MuscleSlug, dir: -1 | 1) => void
  setPreference: (id: string, pref: "preferred" | "excluded" | "neutral") => void
  reset: () => void
}

const initial: OnboardingDraft = {
  goals: ["hypertrophy"],
  experienceLevel: "beginner",
  weeklyFrequency: 3,
  sessionDurationMinutes: 60,
  environment: "full_gym",
  availableEquipment: ENVIRONMENT_EQUIPMENT.full_gym,
  focusMuscles: [],
  preferred: [],
  excluded: [],
  preferredWeekdays: [],
}

export const useOnboardingDraft = create<DraftState>()(set => ({
  ...initial,
  update: patch => set(patch),
  toggleGoal: g => set(s => ({ goals: s.goals.includes(g) ? (s.goals.length > 1 ? s.goals.filter(x => x !== g) : s.goals) : [...s.goals, g].slice(0, 3) })),
  toggleFocus: m => set(s => ({ focusMuscles: s.focusMuscles.includes(m) ? s.focusMuscles.filter(x => x !== m) : [...s.focusMuscles, m].slice(0, 4) })),
  moveFocus: (m, dir) =>
    set(s => {
      const i = s.focusMuscles.indexOf(m)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.focusMuscles.length) return {}
      const next = [...s.focusMuscles]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return { focusMuscles: next }
    }),
  setPreference: (id, pref) =>
    set(s => ({
      preferred: pref === "preferred" ? [...new Set([...s.preferred, id])] : s.preferred.filter(x => x !== id),
      excluded: pref === "excluded" ? [...new Set([...s.excluded, id])] : s.excluded.filter(x => x !== id),
    })),
  reset: () => set(initial),
}))
