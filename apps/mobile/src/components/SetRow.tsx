import { memo } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { SymbolView } from "expo-symbols"
import type { WorkoutSetDto } from "@pondus/shared"
import { gramsToUnit, unitToGrams, type WeightUnit } from "@pondus/shared"
import { NumberField, Text, useTheme } from "@/design-system"
import { haptic } from "@/lib/haptics"
import { SET_TYPE_LABELS, formatWeight } from "@/lib/format"

export interface SetRowProps {
  set: WorkoutSetDto
  unit: WeightUnit
  previous?: { weightGrams: number | null; reps: number | null } | null
  onChange: (patch: Partial<WorkoutSetDto>) => void
  onComplete: () => void
  onLongPress: () => void
  stepGrams: number
}

/**
 * One set: previous → weight → reps → done. Numbers are edited in place; the
 * checkmark commits with a haptic. Tapping the type cycles warm-up/working.
 */
export const SetRow = memo(function SetRow({ set, unit, previous, onChange, onComplete, onLongPress, stepGrams }: SetRowProps) {
  const { colors, space, radius } = useTheme()
  const stepUnit = unit === "kg" ? stepGrams / 1000 : Math.max(2.5, Math.round(gramsToUnit(stepGrams, unit) * 2) / 2)
  const weightValue = set.weightGrams === null ? null : Math.round(gramsToUnit(set.weightGrams, unit) * 100) / 100
  const prevText = previous && (previous.weightGrams !== null || previous.reps !== null) ? `${formatWeight(previous.weightGrams, unit, { withUnit: false })} × ${previous.reps ?? "–"}` : "–"
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={350} style={[styles.row, { paddingVertical: space[2], gap: space[2], backgroundColor: set.completed ? colors.successSoft : "transparent", borderRadius: radius.md, paddingHorizontal: space[1] }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Satztyp ${SET_TYPE_LABELS[set.setType]}`} onPress={() => { haptic("selection"); onChange({ setType: set.setType === "warmup" ? "working" : set.setType === "working" ? "drop" : set.setType === "drop" ? "failure" : "warmup" }) }} style={{ width: 34, alignItems: "center" }}>
        <Text variant="calloutStrong" color={set.setType === "warmup" ? "tertiary" : set.setType === "working" ? "secondary" : "accent"}>
          {set.setType === "warmup" ? "W" : set.setType === "drop" ? "D" : set.setType === "failure" ? "F" : String(set.setNumber)}
        </Text>
      </Pressable>
      <View style={{ width: 64 }}>
        <Text variant="footnote" color="tertiary" numberOfLines={1} align="center">
          {prevText}
        </Text>
      </View>
      <View style={{ flex: 1.3 }}>
        <NumberField value={weightValue} onChange={v => onChange({ weightGrams: v === null ? null : unitToGrams(v, unit) })} step={stepUnit} decimals={unit === "kg" ? 2 : 1} compact placeholder="–" accessibilityLabel="Gewicht" />
      </View>
      <View style={{ flex: 1 }}>
        <NumberField value={set.reps} onChange={v => onChange({ reps: v })} step={1} min={0} max={500} compact placeholder="–" accessibilityLabel="Wiederholungen" />
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel={set.completed ? "Satz erledigt" : "Satz abschließen"}
        onPress={onComplete}
        hitSlop={6}
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: set.completed ? colors.success : colors.surfaceMuted }}
      >
        <SymbolView name="checkmark" size={18} weight="bold" tintColor={set.completed ? colors.textOnAccent : colors.textTertiary} />
      </Pressable>
    </Pressable>
  )
})

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center" } })
