import { useEffect, useRef, useState, type ReactNode } from "react"
import { Pressable, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { GlassSurface, Text, useTheme } from "@/design-system"
import { onRestTimerFinished, useRestTimerStore } from "@/services/rest-timer-store"
import { useSettingsStore } from "@/services/settings-store"
import { formatTimer } from "@/lib/format"
import { haptic } from "@/lib/haptics"

export interface DockAction {
  title: string
  subtitle?: string
  a11y: string
  onPress: () => void
  tone?: "primary" | "secondary"
  icon?: "checkmark" | "flag.checkered" | "arrow.right" | "play.fill"
}

/**
 * The glass dock at the bottom of the active workout: an optional toast row
 * (undo / exercise done), the RIR question for the set just logged, the rest timer and the
 * one main action. Everything the thumb needs, nothing else.
 */
export function WorkoutDock({ toast, prompt, primary, secondary, compact, currentExercise, onLayout }: { toast?: ReactNode; /** A question for the set just logged (RIR), shown above the rest timer where the thumb already is. */ prompt?: ReactNode; primary: DockAction; secondary?: DockAction; compact: boolean; currentExercise: string | null; onLayout?: (height: number) => void }) {
  const { colors, space, radius, sizes } = useTheme()
  const [locked, setLocked] = useState(false)
  const unlock = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (unlock.current && clearTimeout(unlock.current)), [])
  const run = (a: DockAction) => {
    if (locked) return
    setLocked(true)
    unlock.current = setTimeout(() => setLocked(false), 500)
    haptic("medium")
    a.onPress()
  }
  const isPrimary = (primary.tone ?? "primary") === "primary"
  return (
    <View pointerEvents="box-none" onLayout={e => onLayout?.(e.nativeEvent.layout.height)} style={{ gap: space[2] }}>
      <GlassSurface interactive style={{ padding: space[2], gap: space[2] }}>
        {toast}
        {prompt}
        <RestTimerRow compact={compact} currentExercise={currentExercise} />
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {secondary ? (
            <Pressable accessibilityRole="button" accessibilityLabel={secondary.a11y} onPress={() => run(secondary)} style={({ pressed }) => ({ minHeight: sizes.primaryAction, paddingHorizontal: space[4], borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.border : colors.surfaceMuted })}>
              <Text variant="bodyStrong" numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {secondary.title}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={primary.a11y}
            accessibilityState={{ disabled: locked }}
            onPress={() => run(primary)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: sizes.primaryAction,
              borderRadius: radius.pill,
              paddingHorizontal: space[4],
              paddingVertical: space[1],
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: space[3],
              opacity: locked ? 0.6 : 1,
              backgroundColor: isPrimary ? (pressed ? colors.accentPressed : colors.accent) : pressed ? colors.border : colors.surfaceMuted,
            })}
          >
            {primary.icon ? <SymbolView name={primary.icon} size={22} weight="bold" tintColor={isPrimary ? colors.textOnAccent : colors.textPrimary} accessibilityElementsHidden importantForAccessibility="no" /> : null}
            <View style={{ flexShrink: 1, alignItems: primary.icon ? "flex-start" : "center" }}>
              <Text variant="bodyStrong" color={isPrimary ? "onAccent" : "primary"} numberOfLines={compact ? 2 : 1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}>
                {primary.title}
              </Text>
              {primary.subtitle ? (
                <Text variant="footnote" color={isPrimary ? "onAccent" : "secondary"} numberOfLines={1} style={{ opacity: 0.85 }} maxFontSizeMultiplier={1.2}>
                  {primary.subtitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </View>
      </GlassSurface>
    </View>
  )
}

/** Rest timer inside the dock. Driven by a wall-clock end time, so it survives backgrounding. */
function RestTimerRow({ compact, currentExercise }: { compact: boolean; currentExercise: string | null }) {
  const { colors, space } = useTheme()
  const timer = useRestTimerStore()
  const hapticsOn = useSettingsStore(s => s.restTimerHaptics)
  const [, tick] = useState(0)
  const warned = useRef(false)
  const active = timer.endsAt !== null || timer.remainingWhenPaused !== null
  useEffect(() => {
    if (!active) return
    warned.current = false
    const t = setInterval(() => {
      tick(x => x + 1)
      const s = useRestTimerStore.getState()
      if (s.endsAt === null) return
      const left = s.remaining()
      if (left <= 10 && left > 0 && !warned.current && s.durationSeconds > 20) {
        warned.current = true
        if (hapticsOn) haptic("light")
      }
      if (left <= 0) onRestTimerFinished()
    }, 250)
    return () => clearInterval(t)
  }, [active, timer.endsAt, hapticsOn])
  if (!active) return null
  const remaining = timer.remaining()
  const paused = timer.remainingWhenPaused !== null
  const pct = timer.durationSeconds ? Math.min(1, remaining / timer.durationSeconds) : 0
  // The label names the exercise you continue with (also used by the "Pause vorbei" notification).
  // Only worth mentioning when the next set belongs to another exercise.
  const title = `${paused ? "PAUSE ANGEHALTEN" : "PAUSE"}${timer.label && timer.label !== currentExercise ? ` · DANN ${timer.label.toUpperCase()}` : ""}`
  const Btn = ({ label, a11y, icon, onPress }: { label?: string; a11y: string; icon?: "forward.end.fill"; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={() => { haptic("selection"); onPress() }} style={({ pressed }) => ({ minWidth: 44, height: 44, borderRadius: 22, paddingHorizontal: compact ? 0 : space[1], alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.border : colors.surfaceMuted })}>
      {icon ? <SymbolView name={icon} size={16} tintColor={colors.textPrimary} accessibilityElementsHidden importantForAccessibility="no" /> : <Text variant="footnote" maxFontSizeMultiplier={1.1}>{label}</Text>}
    </Pressable>
  )
  return (
    <View style={{ paddingHorizontal: space[2], gap: space[1] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${paused ? "Pause angehalten" : "Pause"}, noch ${formatTimer(remaining)}. ${paused ? "Fortsetzen" : "Anhalten"}`}
          onPress={() => (paused ? timer.resume() : timer.pause())}
          style={{ flex: 1 }}
        >
          <Text variant="caption" color="secondary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {title}
          </Text>
          <Text variant="numeralMedium" maxFontSizeMultiplier={1.1} style={{ opacity: paused ? 0.5 : 1 }}>
            {formatTimer(remaining)}
          </Text>
        </Pressable>
        <Btn label="−15" a11y="15 Sekunden weniger" onPress={() => timer.adjust(-15)} />
        <Btn label="+15" a11y="15 Sekunden mehr" onPress={() => timer.adjust(15)} />
        <Btn icon="forward.end.fill" a11y="Pause beenden" onPress={() => timer.stop()} />
      </View>
      <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.chartMuted, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: colors.accent }} />
      </View>
    </View>
  )
}
