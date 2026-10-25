import { Pressable, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { gramsToUnit, unitToGrams, type WeightUnit, type WorkoutExerciseDto, type WorkoutSetDto } from "@pondus/shared"
import { BigStepper, Card, Text, useTheme } from "@/design-system"
import { SET_TYPE_LABELS } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { formatKg, formatSet, isAssisted, isBodyweight, isWarmup, numberFor, previousFor, stepFor, targetFor, warmupIndexFor, warmupSuggestion, type LibraryLookup, type Values } from "@/features/workout/selectors"

export interface SetEditorProps {
  ex: WorkoutExerciseDto
  set: WorkoutSetDto
  /** Values shown in the steppers (effective values, or the edit draft of a completed set). */
  values: Values
  unit: WeightUnit
  lookup: LibraryLookup
  editingDone: boolean
  compact: boolean
  /** "ALS NÄCHSTES" right after moving on to this exercise. */
  upNext?: boolean
  onChange: (patch: Partial<Values>) => void
  onTypePress: () => void
  onSkipWarmups: () => void
  onSelectFirstWorking: () => void
}

/**
 * The hero of the active workout: the one set you are about to do (or edit),
 * with large steppers for weight and reps and one-tap shortcuts to last
 * time's values and today's target.
 */
export function SetEditor({ ex, set, values, unit, lookup, editingDone, compact, upNext, onChange, onTypePress, onSkipWarmups, onSelectFirstWorking }: SetEditorProps) {
  const { colors, space, radius } = useTheme()
  const warmup = isWarmup(set)
  const assisted = isAssisted(ex, lookup)
  const bodyweight = isBodyweight(ex, lookup)
  const working = ex.sets.filter(s => !isWarmup(s)).length
  const warmups = ex.sets.filter(isWarmup).length
  const title = editingDone
    ? `${warmup ? "AUFWÄRMSATZ" : `SATZ ${numberFor(ex, set)}`} BEARBEITEN`
    : warmup
      ? `AUFWÄRMSATZ ${warmupIndexFor(ex, set)} VON ${warmups}`
      : `SATZ ${numberFor(ex, set)} VON ${working}`
  const step = stepFor(ex, lookup)
  const stepUnit = unit === "kg" ? step / 1000 : Math.max(2.5, Math.round(gramsToUnit(step, unit) * 2) / 2)
  const weightLabel = `${assisted ? "UNTERSTÜTZUNG" : bodyweight ? "ZUSATZGEWICHT" : "GEWICHT"} · ${unit.toUpperCase()}`
  const missingWeight = values.weightGrams === null && !bodyweight && !warmup
  const prev = previousFor(ex, set)
  const target = targetFor(ex, set)
  const differs = (v: Values | null) => !!v && (v.weightGrams !== null || v.reps !== null) && (v.weightGrams !== values.weightGrams || v.reps !== values.reps)
  const suggestion = warmup ? warmupSuggestion(ex, set, lookup) : null
  const setName = warmup ? `Aufwärmsatz ${warmupIndexFor(ex, set)}` : `Satz ${numberFor(ex, set)}`

  const QuickChip = ({ icon, label, v }: { icon: "arrow.counterclockwise" | "scope"; label: string; v: Values }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} übernehmen: ${formatSet(v, unit).replace("×", "mal")}`}
      onPress={() => {
        haptic("selection")
        onChange({ weightGrams: v.weightGrams ?? values.weightGrams, reps: v.reps ?? values.reps })
      }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space[1], minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: pressed ? colors.border : colors.surfaceMuted })}
    >
      <SymbolView name={icon} size={14} weight="semibold" tintColor={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
      <Text variant="footnote" color="secondary" numberOfLines={1}>
        {label} <Text variant="calloutStrong">{formatSet(v, unit)}</Text>
      </Text>
    </Pressable>
  )

  return (
    <View style={{ gap: space[2] }}>
      {upNext ? (
        <Text variant="caption" color="accent">
          ALS NÄCHSTES
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text variant="caption" color={warmup ? "tertiary" : "secondary"} style={{ flex: 1 }} accessibilityRole="header" numberOfLines={2}>
          {title}
          {warmup && !editingDone ? " · zählt nicht" : ""}
          {editingDone ? " · erledigt" : ""}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Satztyp: ${SET_TYPE_LABELS[set.setType]}. Ändern`}
          onPress={onTypePress}
          hitSlop={4}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, height: 36, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: pressed ? colors.border : warmup ? colors.surfaceMuted : colors.accentSoft })}
        >
          <Text variant="footnote" color={warmup ? "secondary" : "accent"}>
            {SET_TYPE_LABELS[set.setType]}
          </Text>
          <SymbolView name="chevron.down" size={11} weight="semibold" tintColor={warmup ? colors.textSecondary : colors.accentText} accessibilityElementsHidden importantForAccessibility="no" />
        </Pressable>
      </View>

      <Card tone={warmup ? "muted" : "surface"} style={{ gap: compact ? space[3] : space[4], borderWidth: editingDone ? 1.5 : 0, borderColor: colors.success }}>
        <BigStepper
          label={weightLabel}
          value={values.weightGrams === null ? null : Math.round(gramsToUnit(values.weightGrams, unit) * 100) / 100}
          onChange={v => onChange({ weightGrams: v === null ? null : unitToGrams(v, unit) })}
          step={stepUnit}
          decimals={unit === "kg" ? 2 : 1}
          max={1000}
          compact={compact}
          onMuted={warmup}
          emphasis={missingWeight ? "missing" : "default"}
          emptyHint={missingWeight ? "Startgewicht wählen" : undefined}
          emptyBase={bodyweight ? 0 : stepUnit * 8}
          accessibilityLabel={`${assisted ? "Unterstützung" : bodyweight ? "Zusatzgewicht" : "Gewicht"}, ${setName}`}
          accessibilityValueText={values.weightGrams === null ? undefined : formatKg(values.weightGrams, unit).replace("kg", "Kilogramm")}
        />
        <View style={{ height: 0.5, backgroundColor: colors.border }} />
        <BigStepper label="WIEDERHOLUNGEN" value={values.reps} onChange={v => onChange({ reps: v })} step={1} max={100} compact={compact} onMuted={warmup} emptyBase={ex.targetRepsMin ?? 8} accessibilityLabel={`Wiederholungen, ${setName}`} />
        {warmup && !editingDone ? (
          suggestion ? (
            <Text variant="footnote" color="tertiary" align="center">
              Vorschlag: {Math.round(suggestion.percent * 100)} % von {formatKg(suggestion.workingWeightGrams, unit)}
            </Text>
          ) : (
            <Pressable accessibilityRole="button" onPress={onSelectFirstWorking} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text variant="footnote" color="secondary" align="center">
                Kein Vorschlag: <Text variant="footnote" color="accent">Leg zuerst dein Arbeitsgewicht fest ›</Text>
              </Text>
            </Pressable>
          )
        ) : null}
      </Card>

      {!warmup && (differs(prev) || differs(target)) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {differs(prev) ? <QuickChip icon="arrow.counterclockwise" label="Zuletzt" v={prev!} /> : null}
          {differs(target) ? <QuickChip icon="scope" label="Ziel" v={target!} /> : null}
        </View>
      ) : null}
      {warmup && !editingDone ? (
        <Pressable accessibilityRole="button" onPress={onSkipWarmups} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
          <Text variant="callout" color="accent">
            Aufwärmen überspringen ›
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
