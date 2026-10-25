import { Pressable, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { Button, Card, Text, useTheme } from "@/design-system"
import { haptic } from "@/lib/haptics"

/** One-time intro for the very first workout. */
export function IntroCard({ onMore, onDismiss }: { onMore: () => void; onDismiss: () => void }) {
  const { space } = useTheme()
  return (
    <Card tone="accent" padding="sm" style={{ gap: space[2] }}>
      <Text variant="calloutStrong">Kurz erklärt</Text>
      <Text variant="footnote" color="secondary">
        Oben steht der Satz, den du gerade machst. Stell Gewicht und Wiederholungen ein und hak ihn unten ab. Aufwärmsätze sind grau markiert und zählen nicht. Aus deinen Arbeitssätzen berechnet Pondus das Ziel fürs nächste Mal.
      </Text>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <Button title="Mehr erfahren" variant="secondary" size="sm" onPress={onMore} />
        <Button title="Verstanden" variant="ghost" size="sm" onPress={onDismiss} />
      </View>
    </Card>
  )
}

/** First time doing an exercise: a one-line pointer to how to pick a starting weight. */
export function FirstTimeCard({ onMore }: { onMore: () => void }) {
  const { colors, space, radius } = useTheme()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Zum ersten Mal? So findest du dein Startgewicht" onPress={onMore} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 44, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2], opacity: pressed ? 0.7 : 1 })}>
      <SymbolView name="lightbulb" size={16} tintColor={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
      <Text variant="footnote" style={{ flex: 1 }}>
        Zum ersten Mal? <Text variant="footnote" color="accent">So findest du dein Startgewicht ›</Text>
      </Text>
    </Pressable>
  )
}

const RIR_OPTIONS = [
  { value: 0, label: "0", a11y: "0, am Limit" },
  { value: 1, label: "1", a11y: "1 Wiederholung in Reserve" },
  { value: 2, label: "2", a11y: "2 Wiederholungen in Reserve" },
  { value: 3, label: "3", a11y: "3 Wiederholungen in Reserve" },
  { value: 4, label: "4+", a11y: "4 oder mehr Wiederholungen in Reserve" },
]

/** Asked right after ticking off a working set, while resting. One compact row: label, five chips, close. Lives in the dock, next to the rest timer. */
export function RirCard({ setName, value, onPick, onDismiss }: { setName: string; value: number | null; onPick: (rir: number) => void; onDismiss: () => void }) {
  const { colors, space, radius, sizes } = useTheme()
  return (
    <Card tone="accent" padding="sm" style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <View style={{ width: 64 }} accessible accessibilityLabel={`${setName}: Wie viele Wiederholungen wären noch gegangen?`}>
        <Text variant="calloutStrong" numberOfLines={1} adjustsFontSizeToFit>
          RIR?
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={1} adjustsFontSizeToFit>
          {setName}
        </Text>
      </View>
      {RIR_OPTIONS.map(o => {
        const selected = value === o.value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={o.a11y}
            accessibilityState={{ selected }}
            onPress={() => {
              haptic("selection")
              onPick(o.value)
            }}
            style={({ pressed }) => ({ flex: 1, height: sizes.chipLarge, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.textPrimary : pressed ? colors.border : colors.surface })}
          >
            <Text variant="bodyStrong" color={selected ? "inverse" : "primary"} maxFontSizeMultiplier={1.2}>
              {o.label}
            </Text>
          </Pressable>
        )
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="RIR-Abfrage schließen" onPress={onDismiss} hitSlop={8} style={{ width: 28, height: 44, alignItems: "center", justifyContent: "center" }}>
        <SymbolView name="xmark" size={14} weight="semibold" tintColor={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
      </Pressable>
    </Card>
  )
}
