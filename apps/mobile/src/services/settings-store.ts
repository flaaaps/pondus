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
      restBellVolume: 0.7,
      defaultRestSeconds: 120,
      workoutIntroSeen: false,
      liveActivityEnabled: true,
      setAppearance: appearance => set({ appearance }),
      setWeightUnit: weightUnit => set({ weightUnit }),
      setRestTimerNotifications: restTimerNotifications => set({ restTimerNotifications }),
      setRestTimerHaptics: restTimerHaptics => set({ restTimerHaptics }),
      setRestBell: restBell => set({ restBell }),
      setRestBellVolume: restBellVolume => set({ restBellVolume }),
      setDefaultRestSeconds: defaultRestSeconds => set({ defaultRestSeconds }),
      setWorkoutIntroSeen: workoutIntroSeen => set({ workoutIntroSeen }),
      setLiveActivityEnabled: liveActivityEnabled => set({ liveActivityEnabled }),
    }),
    { name: "pondus-settings", storage: createJSONStorage(() => AsyncStorage) },
  ),
)
