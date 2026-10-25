import { useEffect, useState } from "react"
import { Pressable, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { GlassSurface, Text, useTheme } from "@/design-system"
import { onRestTimerFinished, useRestTimerStore } from "@/services/rest-timer-store"
import { formatTimer } from "@/lib/format"
import { haptic } from "@/lib/haptics"

/** Floating rest timer. Driven by a wall-clock end time, so it survives backgrounding. */
export function RestTimerBar() {
  const { colors, space } = useTheme()
  const timer = useRestTimerStore()
  const [, tick] = useState(0)
  const active = timer.endsAt !== null || timer.remainingWhenPaused !== null
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => {
      tick(x => x + 1)
      if (useRestTimerStore.getState().endsAt !== null && useRestTimerStore.getState().remaining() <= 0) onRestTimerFinished()
    }, 250)
    return () => clearInterval(t)
  }, [active])
  if (!active) return null
  const remaining = timer.remaining()
  const paused = timer.remainingWhenPaused !== null
  const pct = timer.durationSeconds ? remaining / timer.durationSeconds : 0
  const Btn = ({ label, a11y, onPress, icon }: { label: string; a11y: string; onPress: () => void; icon?: Parameters<typeof SymbolView>[0]["name"] }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={() => { haptic("selection"); onPress() }} style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceMuted : "transparent", flexDirection: "row", gap: 4 })}>
      {icon ? <SymbolView name={icon} size={15} weight="semibold" tintColor={colors.textPrimary} accessibilityElementsHidden importantForAccessibility="no" /> : null}
      <Text variant="calloutStrong" numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </Pressable>
  )
  const title = paused ? "Pause angehalten" : timer.label ? `Pause · ${timer.label}` : "Pause"
  return (
    <GlassSurface interactive style={{ paddingHorizontal: space[3], paddingTop: space[2], paddingBottom: space[1] }}>
      <View accessible accessibilityRole="timer" accessibilityLabel={`${title}, noch ${formatTimer(remaining)}`} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[1] }}>
        <Text variant="footnote" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </Text>
        <Text variant="numeral" maxFontSizeMultiplier={1.2}>{formatTimer(remaining)}</Text>
      </View>
      <View style={{ height: 3, marginTop: space[2], marginHorizontal: space[1], borderRadius: 2, backgroundColor: colors.chartMuted, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: colors.accent }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: space[1] }}>
        <Btn label="−15 s" a11y="15 Sekunden weniger" onPress={() => timer.adjust(-15)} />
        <Btn label="+15 s" a11y="15 Sekunden mehr" onPress={() => timer.adjust(15)} />
        <Btn label={paused ? "Weiter" : "Halt"} a11y={paused ? "Pausentimer fortsetzen" : "Pausentimer anhalten"} icon={paused ? "play.fill" : "pause.fill"} onPress={() => (paused ? timer.resume() : timer.pause())} />
        <Btn label="Fertig" a11y="Pause beenden" icon="xmark" onPress={() => timer.stop()} />
      </View>
    </GlassSurface>
  )
}
