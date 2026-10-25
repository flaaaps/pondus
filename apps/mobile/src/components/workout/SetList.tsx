import { Pressable, View } from "react-native"
import { SymbolView } from "expo-symbols"
import type { WeightUnit, WorkoutExerciseDto, WorkoutSetDto } from "@pondus/shared"
import { Text, useTheme } from "@/design-system"
import { haptic } from "@/lib/haptics"
import { SET_TYPE_LABELS } from "@/lib/format"
import { effectiveValues, formatSet, isWarmup, keyOf, numberFor, type LibraryLookup } from "@/features/workout/selectors"

export interface SetListProps {
  ex: WorkoutExerciseDto
  selectedKey: string | null
  unit: WeightUnit
  lookup: LibraryLookup
  onSelect: (set: WorkoutSetDto) => void
  onOptions: (set: WorkoutSetDto) => void
  onAddSet: () => void
}

/** Compact list of the focused exercise's sets. Tap selects a set for the editor, long press opens its options. */
export function SetList({ ex, selectedKey, unit, lookup, onSelect, onOptions, onAddSet }: SetListProps) {
  const { colors, space, radius, sizes } = useTheme()
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" color="secondary" style={{ marginBottom: space[1] }}>
        SÄTZE
      </Text>
      {ex.sets.map(set => {
        const selected = keyOf(set) === selectedKey
        const warmup = isWarmup(set)
        const v = set.completed ? { weightGrams: set.weightGrams, reps: set.reps } : effectiveValues(ex, set, lookup)
        const badge = warmup ? "W" : set.setType === "drop" ? "D" : set.setType === "failure" ? "F" : String(numberFor(ex, set))
        const name = warmup ? "Aufwärmsatz" : `Satz ${numberFor(ex, set)}${set.setType === "working" ? "" : `, ${SET_TYPE_LABELS[set.setType]}`}`
        const status = set.completed ? "erledigt" : selected ? "jetzt" : "offen"
        return (
          <Pressable
            key={keyOf(set)}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${formatSet(v, unit).replace("–", "kein Gewicht").replace("×", "mal")}${set.rir !== null && set.completed ? `, RIR ${set.rir}` : ""}, ${status}`}
            accessibilityHint={set.completed ? "Bearbeiten" : "Auswählen"}
            accessibilityState={{ selected }}
            accessibilityActions={[{ name: "longpress", label: "Satzoptionen" }]}
            onAccessibilityAction={e => e.nativeEvent.actionName === "longpress" && onOptions(set)}
            onPress={() => {
              haptic("selection")
              onSelect(set)
            }}
            onLongPress={() => {
              haptic("medium")
              onOptions(set)
            }}
            delayLongPress={350}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: sizes.setRow, paddingHorizontal: space[2], borderRadius: radius.md, backgroundColor: selected ? colors.accentSoft : pressed ? colors.surfaceMuted : "transparent" })}
          >
            <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: warmup ? "transparent" : colors.surfaceMuted, borderWidth: warmup ? 1 : 0, borderColor: colors.borderStrong }}>
              <Text variant="footnote" color={warmup ? "tertiary" : set.setType === "working" ? "primary" : "accent"} maxFontSizeMultiplier={1.2}>
                {badge}
              </Text>
            </View>
            <Text variant={set.completed ? "bodyStrong" : "body"} color={set.completed ? "primary" : warmup ? "tertiary" : "secondary"} style={{ fontVariant: ["tabular-nums"] }} numberOfLines={1}>
              {formatSet(v, unit)}
            </Text>
            {set.completed && set.rir !== null && !warmup ? (
              <Text variant="footnote" color="secondary">
                · RIR {set.rir}
              </Text>
            ) : null}
            <View style={{ flex: 1 }} />
            {set.completed ? (
              <SymbolView name="checkmark.circle.fill" size={22} tintColor={colors.success} accessibilityElementsHidden importantForAccessibility="no" />
            ) : selected ? (
              <Text variant="footnote" color="accent">
                jetzt
              </Text>
            ) : null}
          </Pressable>
        )
      })}
      <Pressable accessibilityRole="button" accessibilityLabel={`Satz zu ${ex.exerciseNameSnapshot} hinzufügen`} onPress={onAddSet} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space[2] }}>
        <Text variant="callout" color="accent">
          + Satz hinzufügen
        </Text>
      </Pressable>
    </View>
  )
}
