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
  /** Number shown for non-warm-up sets (counts working sets only, so warm-ups don't shift it). Defaults to `setNumber`. */
  displayNumber?: number
  unit: WeightUnit
  previous?: { weightGrams: number | null; reps: number | null } | null
  /** What `previous` is: last session's value or a warm-up suggestion. */
  previousKind?: "previous" | "warmup"
  /** Progression target for this set (from the plan's next targets); shown only when the entered values differ. */
  target?: { weightGrams: number | null; reps: number | null } | null
  /** Assisted exercise: the weight is assistance (lower = harder). */
  assisted?: boolean
  onChange: (patch: Partial<WorkoutSetDto>) => void
  onComplete: () => void
  onLongPress: () => void
  stepGrams: number
  /** Width of the set column (number + last time); scaled with Dynamic Type by the caller. */
  setColumnWidth?: number
  /** Show inline RIR chips (right after the set was ticked off). */
  rirPrompt?: boolean
  onRir?: (rir: number) => void
}

const RIR_OPTIONS = [0, 1, 2, 3, 4]

/**
 * One set: previous → weight → reps → done. Numbers are edited in place; the
 * checkmark commits with a haptic. Tapping the type cycles warm-up/working.
 */
export const SetRow = memo(function SetRow({ set, displayNumber, unit, previous, previousKind = "previous", target, assisted, onChange, onComplete, onLongPress, stepGrams, setColumnWidth = 56, rirPrompt, onRir }: SetRowProps) {
  const { colors, space, radius } = useTheme()
  const stepUnit = unit === "kg" ? stepGrams / 1000 : Math.max(2.5, Math.round(gramsToUnit(stepGrams, unit) * 2) / 2)
  const weightValue = set.weightGrams === null ? null : Math.round(gramsToUnit(set.weightGrams, unit) * 100) / 100
  const hasPrev = !!previous && (previous.weightGrams !== null || previous.reps !== null)
  const prevText = hasPrev ? `${formatWeight(previous!.weightGrams, unit, { withUnit: false })} × ${previous!.reps ?? "–"}` : "–"
  const weightName = assisted ? "Unterstützung" : "Gewicht"
  const hasTarget = !!target && (target.weightGrams !== null || target.reps !== null)
  const offTarget = hasTarget && !set.completed && (target!.weightGrams !== set.weightGrams || target!.reps !== set.reps)
  const targetText = hasTarget ? `${target!.weightGrams === null ? "" : `${formatWeight(target!.weightGrams, unit)}${assisted ? " Unterst." : ""} × `}${target!.reps ?? "–"}` : ""
  const shownNumber = displayNumber ?? set.setNumber
  const typeLabel = set.setType === "warmup" ? "Aufwärmsatz" : `Satz ${shownNumber}${set.setType === "working" ? "" : `, ${SET_TYPE_LABELS[set.setType]}`}`
  const setValue = `${set.weightGrams === null ? "kein Gewicht" : formatWeight(set.weightGrams, unit)}, ${set.reps ?? "keine"} Wiederholungen`
  return (
    <View style={{ backgroundColor: set.completed ? colors.successSoft : "transparent", borderRadius: radius.md }}>
      {/* Not an accessibility element itself: VoiceOver reaches each control; set options are an action on the set number. */}
      <Pressable accessible={false} onLongPress={onLongPress} delayLongPress={350} style={[styles.row, { paddingVertical: space[2], gap: space[2], paddingHorizontal: space[1] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${typeLabel}${hasPrev ? `, ${previousKind === "warmup" ? "Vorschlag" : "zuletzt"} ${prevText.replace("×", "mal")}` : ""}${hasTarget ? `, Ziel ${targetText.replace("×", "mal")}` : ""}`}
          accessibilityHint="Ändert den Satztyp"
          accessibilityActions={[{ name: "longpress", label: "Satzoptionen" }]}
          onAccessibilityAction={e => e.nativeEvent.actionName === "longpress" && onLongPress()}
          onPress={() => {
            haptic("selection")
            onChange({ setType: set.setType === "warmup" ? "working" : set.setType === "working" ? "drop" : set.setType === "drop" ? "failure" : "warmup" })
          }}
          style={{ width: setColumnWidth, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Text variant="calloutStrong" color={set.setType === "warmup" ? "tertiary" : set.setType === "working" ? "secondary" : "accent"}>
            {set.setType === "warmup" ? "W" : set.setType === "drop" ? "D" : set.setType === "failure" ? "F" : String(shownNumber)}
          </Text>
          {/* Last time's value sits under the number: keeps the weight/reps fields wide enough to type into. */}
          {hasPrev ? (
            <Text variant="caption" color="tertiary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {previousKind === "warmup" ? `≈${prevText}` : prevText}
            </Text>
          ) : null}
        </Pressable>
        <View style={{ flex: 1.3 }}>
          <NumberField value={weightValue} onChange={v => onChange({ weightGrams: v === null ? null : unitToGrams(v, unit) })} step={stepUnit} decimals={unit === "kg" ? 2 : 1} compact placeholder="–" accessibilityLabel={`${weightName} ${typeLabel}`} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField value={set.reps} onChange={v => onChange({ reps: v })} step={1} min={0} max={500} compact placeholder="–" accessibilityLabel={`Wiederholungen ${typeLabel}`} />
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: set.completed }}
          accessibilityLabel={`${typeLabel} ${set.completed ? "erledigt" : "abschließen"}`}
          accessibilityValue={{ text: setValue }}
          onPress={onComplete}
          hitSlop={6}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: set.completed ? colors.success : colors.surfaceMuted }}
        >
          <SymbolView name="checkmark" size={18} weight="bold" tintColor={set.completed ? colors.textOnAccent : colors.textTertiary} accessibilityElementsHidden importantForAccessibility="no" />
        </Pressable>
      </Pressable>
      {offTarget ? (
        <Text variant="caption" color="accent" numberOfLines={1} style={{ paddingLeft: setColumnWidth + space[3], marginTop: -space[1], paddingBottom: space[1] }} accessibilityElementsHidden importantForAccessibility="no">
          Ziel {targetText}
        </Text>
      ) : null}
      {rirPrompt && onRir ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[2], paddingBottom: space[2] }}>
          <Text variant="footnote" color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            Reserve (RIR)
          </Text>
          <View style={{ flexDirection: "row", gap: space[1], flex: 1, justifyContent: "flex-end" }}>
            {RIR_OPTIONS.map(r => (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityLabel={r === 4 ? "4 oder mehr Wiederholungen in Reserve" : `${r} Wiederholungen in Reserve`}
                accessibilityState={{ selected: set.rir === r }}
                onPress={() => {
                  haptic("selection")
                  onRir(r)
                }}
                style={{ minWidth: 44, height: 36, paddingHorizontal: space[2], borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: set.rir === r ? colors.textPrimary : colors.surface }}
                hitSlop={4}
              >
                <Text variant="calloutStrong" style={{ color: set.rir === r ? colors.textInverse : colors.textPrimary }}>
                  {r === 4 ? "4+" : String(r)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center" } })
