import { View } from "react-native"
import Svg, { Circle } from "react-native-svg"
import { useTheme } from "../theme"
import { Text } from "./Text"

export function ProgressBar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "success" }) {
  const { colors, radius } = useTheme()
  const pct = max <= 0 ? 0 : Math.min(1, value / max)
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }} style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.chartMuted, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: tone === "accent" ? colors.accent : colors.success, borderRadius: radius.pill }} />
    </View>
  )
}

export function ProgressRing({ value, max, size = 64, stroke = 6, label }: { value: number; max: number; size?: number; stroke?: number; label?: string }) {
  const { colors } = useTheme()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max <= 0 ? 0 : Math.min(1, value / max)
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.chartMuted} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.accent} strokeWidth={stroke} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" />
      </Svg>
      {label ? <Text variant="calloutStrong">{label}</Text> : null}
    </View>
  )
}
