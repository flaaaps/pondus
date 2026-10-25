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
  defaultRestSeconds: number
  setAppearance: (a: Appearance) => void
  setWeightUnit: (u: WeightUnit) => void
  setRestTimerNotifications: (v: boolean) => void
  setRestTimerHaptics: (v: boolean) => void
  setDefaultRestSeconds: (v: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      appearance: "system",
      weightUnit: "kg",
      restTimerNotifications: true,
      restTimerHaptics: true,
      defaultRestSeconds: 120,
      setAppearance: appearance => set({ appearance }),
      setWeightUnit: weightUnit => set({ weightUnit }),
      setRestTimerNotifications: restTimerNotifications => set({ restTimerNotifications }),
      setRestTimerHaptics: restTimerHaptics => set({ restTimerHaptics }),
      setDefaultRestSeconds: defaultRestSeconds => set({ defaultRestSeconds }),
    }),
    { name: "pondus-settings", storage: createJSONStorage(() => AsyncStorage) },
  ),
)
