import { useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, TextInput, View } from "react-native"
import { useTheme } from "../theme"
import { Text } from "./Text"
import { haptic } from "@/lib/haptics"

export interface NumberFieldProps {
  value: number | null
  onChange: (value: number | null) => void
  step: number
  min?: number
  max?: number
  /** Decimal places shown/accepted. */
  decimals?: number
  label?: string
  suffix?: string
  placeholder?: string
  compact?: boolean
  accessibilityLabel?: string
}

/**
 * Directly editable number with ± steppers. Used for weight and reps during a
 * workout: big touch targets, tabular digits, no modal.
 */
export function NumberField({ value, onChange, step, min = 0, max = 100000, decimals = 0, label, suffix, placeholder, compact, accessibilityLabel }: NumberFieldProps) {
  const { colors, radius, space, typography, sizes } = useTheme()
  const [text, setText] = useState(value === null ? "" : format(value, decimals))
  const editing = useRef(false)
  useEffect(() => {
    if (!editing.current) setText(value === null ? "" : format(value, decimals))
  }, [value, decimals])

  const commit = (raw: string) => {
    const normalised = raw.replace(",", ".").trim()
    if (!normalised) return onChange(null)
    const n = Number(normalised)
    if (Number.isFinite(n)) onChange(clamp(round(n, decimals), min, max))
  }
  const bump = (dir: 1 | -1) => {
    haptic("selection")
    const base = value ?? 0
    onChange(clamp(round(base + dir * step, decimals), min, max))
  }
  const size = compact ? 40 : sizes.touchTarget

  return (
    <View style={{ gap: space[1] }}>
      {label ? (
        <Text variant="caption" color="tertiary" align="center">
          {label.toUpperCase()}
        </Text>
      ) : null}
      <View style={[styles.row, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${accessibilityLabel ?? label ?? "Wert"} verringern`} onPress={() => bump(-1)} hitSlop={6} style={[styles.stepper, { width: size, height: size }]}>
          <Text variant="title3" color="secondary">
            −
          </Text>
        </Pressable>
        <View style={styles.center}>
          <TextInput
            accessibilityLabel={accessibilityLabel ?? label}
            value={text}
            onChangeText={setText}
            onFocus={() => (editing.current = true)}
            onBlur={() => {
              editing.current = false
              commit(text)
            }}
            onSubmitEditing={() => commit(text)}
            keyboardType={decimals > 0 ? "decimal-pad" : "number-pad"}
            returnKeyType="done"
            selectTextOnFocus
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            style={[typography.numeral, compact ? { fontSize: 20, lineHeight: 24 } : null, { color: colors.textPrimary, textAlign: "center", minWidth: 56, paddingVertical: 0 }]}
          />
          {suffix ? (
            <Text variant="caption" color="tertiary">
              {suffix}
            </Text>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${accessibilityLabel ?? label ?? "Wert"} erhöhen`} onPress={() => bump(1)} hitSlop={6} style={[styles.stepper, { width: size, height: size }]}>
          <Text variant="title3" color="secondary">
            +
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const format = (n: number, decimals: number) => (decimals > 0 ? n.toFixed(decimals).replace(/\.?0+$/, "") : String(Math.round(n)))
const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  stepper: { alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 },
})
