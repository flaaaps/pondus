import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { BlurView } from "expo-blur"
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect"
import { useTheme } from "../theme"
import type { PropsWithChildren } from "react"

/**
 * Floating translucent surface. Uses native Liquid Glass on iOS 26+, a blur
 * fallback on older iOS. Used only for floating controls (rest timer bar,
 * sticky actions), never for content cards – readability first.
 */
export function GlassSurface({ children, style, interactive }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; interactive?: boolean }>) {
  const { colors, radius, scheme } = useTheme()
  const base: ViewStyle = { borderRadius: radius.xl, overflow: "hidden" }
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} style={[base, style]}>
        {children}
      </GlassView>
    )
  }
  return (
    <View style={[base, { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong }, style]}>
      <BlurView intensity={40} tint={scheme === "dark" ? "systemThickMaterialDark" : "systemThickMaterialLight"} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassTint }]} />
      {children}
    </View>
  )
}
