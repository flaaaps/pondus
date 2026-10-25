import { Pressable, StyleSheet } from "react-native"
import { useTheme } from "../theme"
import { Text } from "./Text"
import { haptic } from "@/lib/haptics"

export interface ChipProps {
  label: string
  selected?: boolean
  onPress?: () => void
  tone?: "default" | "accent" | "success" | "danger" | "warning"
  size?: "sm" | "md"
  accessibilityLabel?: string
}

export function Chip({ label, selected, onPress, tone = "default", size = "md", accessibilityLabel }: ChipProps) {
  const { colors, radius, space, sizes } = useTheme()
  const height = size === "md" ? 36 : 28
  // Visual size stays compact; the hit area is extended to the 44 pt minimum.
  const slop = Math.ceil((sizes.touchTarget - height) / 2)
  const toneBg = { default: colors.surfaceMuted, accent: colors.accentSoft, success: colors.successSoft, danger: colors.dangerSoft, warning: colors.warningSoft }[tone]
  const bg = selected ? colors.textPrimary : toneBg
  const fg = selected ? colors.textInverse : { default: colors.textPrimary, accent: colors.accentText, success: colors.success, danger: colors.danger, warning: colors.textPrimary }[tone]
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={accessibilityLabel}
      hitSlop={onPress ? { top: slop, bottom: slop, left: 4, right: 4 } : undefined}
      accessibilityState={{ selected: !!selected }}
      disabled={!onPress}
      onPress={() => {
        haptic("selection")
        onPress?.()
      }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: size === "md" ? space[4] : space[3], height, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text variant={size === "md" ? "calloutStrong" : "caption"} style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  )
}
const styles = StyleSheet.create({ chip: { alignItems: "center", justifyContent: "center" } })
