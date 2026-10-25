import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native"
import { useTheme } from "../theme"
import type { PropsWithChildren } from "react"

export interface CardProps extends ViewProps {
  padding?: "none" | "sm" | "md" | "lg"
  tone?: "surface" | "muted" | "accent" | "strong"
  onPress?: () => void
  elevated?: boolean
  style?: StyleProp<ViewStyle>
}

export function Card({ children, padding = "md", tone = "surface", onPress, elevated, style, ...rest }: PropsWithChildren<CardProps>) {
  const { colors, radius, space, shadows } = useTheme()
  const pad = { none: 0, sm: space[3], md: space[4], lg: space[5] }[padding]
  const background = { surface: colors.surface, muted: colors.surfaceMuted, accent: colors.accentSoft, strong: colors.surfaceStrong }[tone]
  const content = (
    <View
      {...rest}
      style={[
        { backgroundColor: background, borderRadius: radius.lg, padding: pad, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        elevated ? shadows.sm : null,
        style,
      ]}
    >
      {children}
    </View>
  )
  if (!onPress) return content
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] })}>
      {content}
    </Pressable>
  )
}
