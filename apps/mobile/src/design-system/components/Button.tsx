import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"
import { useTheme } from "../theme"
import { Text } from "./Text"
import { haptic } from "@/lib/haptics"
import type { ReactNode } from "react"

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  title: string
  variant?: "primary" | "secondary" | "ghost" | "danger" | "glass"
  size?: "md" | "sm"
  loading?: boolean
  icon?: ReactNode
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  hapticStyle?: "light" | "medium" | "selection" | "none"
}

export function Button({ title, variant = "primary", size = "md", loading, icon, fullWidth, style, disabled, onPress, hapticStyle = "light", ...rest }: ButtonProps) {
  const { colors, radius, sizes, motion, space } = useTheme()
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const isDisabled = disabled || loading
  const bg = { primary: colors.accent, secondary: colors.surfaceMuted, ghost: "transparent", danger: colors.dangerSoft, glass: colors.glassTint }[variant]
  const fg: "onAccent" | "primary" | "accent" | "danger" = { primary: "onAccent" as const, secondary: "primary" as const, ghost: "accent" as const, danger: "danger" as const, glass: "primary" as const }[variant]
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPressIn={() => (scale.value = withSpring(0.97, motion.springSnappy))}
      onPressOut={() => (scale.value = withSpring(1, motion.springSnappy))}
      onPress={e => {
        if (hapticStyle !== "none") haptic(hapticStyle)
        onPress?.(e)
      }}
      style={[
        styles.base,
        animated,
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          height: size === "md" ? sizes.buttonHeight : sizes.buttonHeightSmall,
          paddingHorizontal: size === "md" ? space[6] : space[4],
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          borderWidth: variant === "glass" ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.borderStrong,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.textOnAccent : colors.textPrimary} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant={size === "md" ? "bodyStrong" : "calloutStrong"} color={fg}>
            {title}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
})
