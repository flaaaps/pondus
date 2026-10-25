import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from "react"
import { Appearance, useColorScheme } from "react-native"
import { darkColors, lightColors, motion, radius, shadows, sizes, space, typography, type ColorScheme } from "./tokens"
import { useSettingsStore } from "@/services/settings-store"

export interface Theme {
  scheme: "light" | "dark"
  colors: ColorScheme
  space: typeof space
  radius: typeof radius
  typography: typeof typography
  shadows: typeof shadows
  motion: typeof motion
  sizes: typeof sizes
}

const ThemeContext = createContext<Theme | null>(null)

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme()
  const preference = useSettingsStore(s => s.appearance)
  const scheme: "light" | "dark" = preference === "system" ? (system === "dark" ? "dark" : "light") : preference
  // Native chrome (header material, tab bar, alerts, action sheets) follows the in-app choice too, not only the system setting.
  useEffect(() => {
    Appearance.setColorScheme(preference === "system" ? "unspecified" : preference)
  }, [preference])
  const value = useMemo<Theme>(
    () => ({ scheme, colors: scheme === "dark" ? darkColors : lightColors, space, radius, typography, shadows, motion, sizes }),
    [scheme],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
  return ctx
}
