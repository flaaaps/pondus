import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { WeightUnit } from "@pondus/shared"

export type Appearance = "system" | "light" | "dark"

interface SettingsState {
  appearance: Appearance
  weightUnit: WeightUnit
  restTimerNotifications: boolean
  restTimerHaptics: boolean
  /** Ring a bell at the end of a rest when headphones are connected, instead of the notification. */
  restBell: boolean
  /** Bell volume relative to the system volume (0…1). */
  restBellVolume: number
  /** Turn music and podcasts down while the bell plays. */
  restBellDuck: boolean
  defaultRestSeconds: number
  /** The short "how to log" intro in the active workout was dismissed. */
  workoutIntroSeen: boolean
  /** Show the active workout as a Live Activity on the Lock Screen and in the Dynamic Island. */
  liveActivityEnabled: boolean
  setAppearance: (a: Appearance) => void
  setWeightUnit: (u: WeightUnit) => void
  setRestTimerNotifications: (v: boolean) => void
  setRestTimerHaptics: (v: boolean) => void
  setRestBell: (v: boolean) => void
  setRestBellVolume: (v: number) => void
  setRestBellDuck: (v: boolean) => void
  setDefaultRestSeconds: (v: number) => void
  setWorkoutIntroSeen: (v: boolean) => void
  setLiveActivityEnabled: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      appearance: "system",
      weightUnit: "kg",
      restTimerNotifications: true,
      restTimerHaptics: true,
      restBell: true,
      restBellVolume: 1,
      restBellDuck: true,
      defaultRestSeconds: 120,
      workoutIntroSeen: false,
      liveActivityEnabled: true,
      setAppearance: appearance => set({ appearance }),
      setWeightUnit: weightUnit => set({ weightUnit }),
      setRestTimerNotifications: restTimerNotifications => set({ restTimerNotifications }),
      setRestTimerHaptics: restTimerHaptics => set({ restTimerHaptics }),
      setRestBell: restBell => set({ restBell }),
      setRestBellVolume: restBellVolume => set({ restBellVolume }),
      setRestBellDuck: restBellDuck => set({ restBellDuck }),
      setDefaultRestSeconds: defaultRestSeconds => set({ defaultRestSeconds }),
      setWorkoutIntroSeen: workoutIntroSeen => set({ workoutIntroSeen }),
      setLiveActivityEnabled: liveActivityEnabled => set({ liveActivityEnabled }),
    }),
    {
      name: "pondus-settings",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // v1: the bell was too quiet over music. The old default (0.7) moves to the new one (1), a
      // deliberately chosen "Leise" (0.4) to the new "Leise".
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<SettingsState>
        if (version < 1 && typeof s.restBellVolume === "number") s.restBellVolume = s.restBellVolume <= 0.4 ? 0.5 : 1
        return s as SettingsState
      },
    },
  ),
)
