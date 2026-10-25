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
  const Btn = ({ label, onPress, icon }: { label: string; onPress: () => void; icon?: Parameters<typeof SymbolView>[0]["name"] }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { haptic("selection"); onPress() }} hitSlop={6} style={({ pressed }) => ({ paddingHorizontal: space[3], height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceMuted : "transparent", flexDirection: "row", gap: 4 })}>
      {icon ? <SymbolView name={icon} size={16} weight="semibold" tintColor={colors.textPrimary} /> : null}
      <Text variant="calloutStrong">{label}</Text>
    </Pressable>
  )
  return (
    <GlassSurface interactive style={{ padding: space[2], paddingLeft: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="tertiary">
            {paused ? "PAUSE ANGEHALTEN" : timer.label ? `PAUSE · ${timer.label.toUpperCase()}` : "PAUSE"}
          </Text>
          <Text variant="numeral">{formatTimer(remaining)}</Text>
        </View>
        <Btn label="−15" onPress={() => timer.adjust(-15)} />
        <Btn label="+15" onPress={() => timer.adjust(15)} />
        <Btn label={paused ? "Weiter" : "Halt"} icon={paused ? "play.fill" : "pause.fill"} onPress={() => (paused ? timer.resume() : timer.pause())} />
        <Btn label="Fertig" icon="xmark" onPress={() => timer.stop()} />
      </View>
      <View style={{ height: 3, marginTop: space[2], borderRadius: 2, backgroundColor: colors.chartMuted, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: colors.accent }} />
      </View>
    </GlassSurface>
  )
}
