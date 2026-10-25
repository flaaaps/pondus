import { useEffect, useRef, useState } from "react"
import { Pressable, TextInput, View, type TextInputInstance } from "react-native"
import { SymbolView } from "expo-symbols"
import { useTheme } from "../theme"
import { Text } from "./Text"
import { haptic } from "@/lib/haptics"

export interface BigStepperProps {
  value: number | null
  onChange: (value: number | null) => void
  step: number
  min?: number
  max?: number
  /** Decimal places shown/accepted. */
  decimals?: number
  /** Caption above the number, e.g. "GEWICHT · KG". */
  label: string
  /** Spoken name, e.g. "Gewicht, Satz 2". */
  accessibilityLabel: string
  /** Spoken value, e.g. "82,5 Kilogramm". Defaults to the number. */
  accessibilityValueText?: string
  /** Smaller ± buttons (small screens, large text). */
  compact?: boolean
  /** Accent outline, e.g. when a value still has to be chosen. */
  emphasis?: "default" | "missing"
  /** Shown instead of "–" when empty. */
  emptyHint?: string
  /** Value + to start from when empty (defaults to `min`). */
  emptyBase?: number
  /** Sits on a muted surface: buttons use the regular surface colour so they stay visible. */
  onMuted?: boolean
}

const REPEAT_DELAY = 150
const REPEAT_FAST = 75
const FAST_AFTER = 8

/**
 * Large stepper for the active workout: 64 pt ± buttons, the number in the
 * middle is tappable to type. Holding ± repeats (and speeds up). VoiceOver sees
 * one adjustable element (swipe up/down), double tap opens the keyboard.
 */
export function BigStepper({ value, onChange, step, min = 0, max = 100000, decimals = 0, label, accessibilityLabel, accessibilityValueText, compact, emphasis = "default", emptyHint, emptyBase, onMuted }: BigStepperProps) {
  const { colors, radius, space, typography, sizes } = useTheme()
  const [text, setText] = useState(format(value, decimals))
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<TextInputInstance>(null)
  const current = useRef(value)
  const repeat = useRef<{ timer: ReturnType<typeof setTimeout> | null; count: number }>({ timer: null, count: 0 })
  current.current = value

  useEffect(() => {
    if (!editing) setText(format(value, decimals))
  }, [value, decimals, editing])
  useEffect(() => () => stopRepeat(), [])

  const bump = (dir: 1 | -1): boolean => {
    const base = current.current ?? (dir > 0 ? (emptyBase ?? min) - step : (emptyBase ?? min) + step)
    const next = clamp(round(base + dir * step, decimals), min, max)
    if (current.current !== null && next === current.current) {
      haptic("warning")
      return false
    }
    current.current = next
    onChange(next)
    haptic("selection")
    return true
  }
  const startRepeat = (dir: 1 | -1) => {
    stopRepeat()
    const tick = () => {
      if (!bump(dir)) return stopRepeat()
      repeat.current.count += 1
      repeat.current.timer = setTimeout(tick, repeat.current.count > FAST_AFTER ? REPEAT_FAST : REPEAT_DELAY)
    }
    tick()
  }
  function stopRepeat() {
    if (repeat.current.timer) clearTimeout(repeat.current.timer)
    repeat.current = { timer: null, count: 0 }
  }
  const commit = (raw: string) => {
    const normalised = raw.replace(",", ".").trim()
    if (!normalised) return onChange(null)
    const n = Number(normalised)
    if (Number.isFinite(n)) onChange(clamp(round(n, decimals), min, max))
  }

  const btn = compact ? sizes.stepperCompact : sizes.stepperLarge
  const Btn = ({ dir }: { dir: 1 | -1 }) => (
    <Pressable
      importantForAccessibility="no"
      accessibilityElementsHidden
      onPress={() => bump(dir)}
      onLongPress={() => startRepeat(dir)}
      delayLongPress={350}
      onPressOut={stopRepeat}
      hitSlop={4}
      style={({ pressed }) => ({ width: btn, height: btn, borderRadius: btn / 2, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.border : onMuted ? colors.surface : colors.surfaceMuted })}
    >
      <SymbolView name={dir > 0 ? "plus" : "minus"} size={compact ? 22 : 26} weight="bold" tintColor={colors.textPrimary} />
    </Pressable>
  )

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: value === null ? "leer" : (accessibilityValueText ?? format(value, decimals)) }}
      accessibilityHint="Zum Ändern nach oben oder unten wischen, doppeltippen zum Eintippen"
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }, { name: "activate" }]}
      onAccessibilityAction={e => {
        if (e.nativeEvent.actionName === "increment") bump(1)
        else if (e.nativeEvent.actionName === "decrement") bump(-1)
        else inputRef.current?.focus()
      }}
      style={{ gap: space[1] }}
    >
      <Text variant="caption" color={emphasis === "missing" ? "accent" : "secondary"} align="center" numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Btn dir={-1} />
        <Pressable onPress={() => inputRef.current?.focus()} style={{ flex: 1, minHeight: btn, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: emphasis === "missing" ? 2 : 0, borderColor: colors.accent }}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={t => {
              setText(t)
              // Take valid input right away, so the dock never acts on a stale value.
              const n = Number(t.replace(",", ".").trim())
              if (t.trim() && Number.isFinite(n)) onChange(clamp(round(n, decimals), min, max))
            }}
            onFocus={() => setEditing(true)}
            onBlur={() => {
              setEditing(false)
              commit(text)
            }}
            onSubmitEditing={() => commit(text)}
            keyboardType={decimals > 0 ? "decimal-pad" : "number-pad"}
            selectTextOnFocus
            maxFontSizeMultiplier={1.2}
            placeholder={emptyHint ?? "–"}
            placeholderTextColor={colors.textTertiary}
            style={[compact ? typography.numeralMedium : typography.numeralLarge, { color: colors.textPrimary, textAlign: "center", alignSelf: "stretch", paddingVertical: 0, paddingHorizontal: 0 }, value === null && emptyHint ? { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: 0 } : null]}
          />
        </Pressable>
        <Btn dir={1} />
      </View>
    </View>
  )
}

const format = (n: number | null, decimals: number) => (n === null ? "" : (decimals > 0 ? n.toFixed(decimals).replace(/\.?0+$/, "") : String(Math.round(n))).replace(".", ","))
const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
