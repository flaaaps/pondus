import { useState } from "react"
import { Pressable, View } from "react-native"
import { SymbolView } from "expo-symbols"
import type { WeightUnit, WorkoutExerciseDto } from "@pondus/shared"
import { Chip, Text, useTheme } from "@/design-system"
import { ExerciseAnimation } from "@/components/ExerciseMedia"
import { targetBadge } from "@/features/workout/selectors"

/** Focused exercise: movement animation, name, prescription, progression badge (tap → reason) and the exercise menu. */
export function ExerciseHeader({ ex, slug, unit, assisted, defaultRest, compact, onOptions, onExplain }: { ex: WorkoutExerciseDto; slug?: string; unit: WeightUnit; assisted: boolean; defaultRest: number; compact: boolean; onOptions: () => void; onExplain: () => void }) {
  const { colors, space } = useTheme()
  const [showReason, setShowReason] = useState(false)
  const badge = targetBadge(ex.nextTarget, unit, assisted)
  const rest = ex.restSeconds ?? defaultRest
  const meta = [
    ex.targetSets ? `${ex.targetSets} × ${ex.targetRepsMin ?? "?"}–${ex.targetRepsMax ?? "?"}` : "frei",
    ex.targetRir !== null ? `RIR ${ex.targetRir}` : null,
    `Pause ${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, "0")}`,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        {compact ? null : <ExerciseAnimation slug={slug} style={{ width: 96, borderRadius: 12 }} showIndicator={false} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title3" numberOfLines={2} accessibilityRole="header">
            {ex.exerciseNameSnapshot}
          </Text>
          <Text variant="footnote" color="secondary">
            {meta}
          </Text>
          {badge ? (
            <View style={{ flexDirection: "row", marginTop: space[1] }}>
              <Chip size="sm" label={`${badge.label}  ⓘ`} tone={badge.tone} accessibilityLabel={`${badge.a11y}. Begründung ${showReason ? "ausblenden" : "anzeigen"}`} onPress={() => setShowReason(v => !v)} />
            </View>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Optionen für ${ex.exerciseNameSnapshot}`} onPress={onOptions} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
          <SymbolView name="ellipsis.circle" size={26} tintColor={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
        </Pressable>
      </View>
      {badge && showReason && ex.nextTarget ? (
        <Text variant="footnote" color="secondary">
          {ex.nextTarget.reason}{" "}
          <Text variant="footnote" color="accent" accessibilityRole="link" onPress={onExplain}>
            Wie wird das berechnet?
          </Text>
        </Text>
      ) : null}
    </View>
  )
}
