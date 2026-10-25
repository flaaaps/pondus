import { useState } from "react"
import { View } from "react-native"
import { Stack, useLocalSearchParams } from "expo-router"
import { gramsToUnit } from "@pondus/shared"
import { Card, ErrorState, LineChart, ListRow, LoadingState, Screen, Section, SegmentedControl, Stat, Text, useTheme } from "@/design-system"
import { useExerciseProgress, type Range } from "@/features/progress/queries"
import { useSettingsStore } from "@/services/settings-store"
import { formatDate, formatTonnage, formatWeight } from "@/lib/format"

export default function ExerciseProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { space } = useTheme()
  const unit = useSettingsStore(s => s.weightUnit)
  const [range, setRange] = useState<Range>("12w")
  const [metric, setMetric] = useState<"top" | "e1rm" | "tonnage">("top")
  const q = useExerciseProgress(id, range)
  if (q.isLoading) return <LoadingState />
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />
  const d = q.data
  const points = d.points
    .map(p => ({ label: formatDate(p.performedAt), value: metric === "top" ? gramsToUnit(p.topWeightGrams, unit) : metric === "e1rm" ? (p.estimated1rmGrams ? gramsToUnit(p.estimated1rmGrams, unit) : NaN) : gramsToUnit(p.tonnageGrams, unit), caption: metric === "top" ? `${p.topReps} Wdh.` : undefined }))
    .filter(p => Number.isFinite(p.value))
    .map(p => ({ ...p, value: Math.round(p.value * 10) / 10 }))
  const r = d.recommendation
  return (
    <>
      <Stack.Screen options={{ title: d.exerciseName, headerLargeTitle: false }} />
      <Screen>
        <SegmentedControl options={[{ value: "4w", label: "4 W" }, { value: "12w", label: "12 W" }, { value: "6m", label: "6 M" }, { value: "1y", label: "1 J" }, { value: "all", label: "Alle" }]} value={range} onChange={setRange} />
        <Card>
          <SegmentedControl options={[{ value: "top", label: "Top-Satz" }, { value: "e1rm", label: "e1RM" }, { value: "tonnage", label: "Volumen" }]} value={metric} onChange={setMetric} />
          <View style={{ height: space[3] }} />
          <LineChart data={points} formatValue={v => (metric === "tonnage" ? formatTonnage(unit === "kg" ? v * 1000 : v * 453.59237, unit) : `${v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ${unit}`)} emptyLabel="Noch keine Daten im Zeitraum" />
          {metric === "e1rm" ? (
            <Text variant="footnote" color="tertiary" style={{ marginTop: space[2] }}>
              Geschätztes Einer-Maximum (Epley) aus Sätzen bis 12 Wiederholungen. Eine Schätzung, kein gemessener Wert.
            </Text>
          ) : null}
        </Card>
        <Card>
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Stat label="Max. Gewicht" value={formatWeight(d.bests.maxWeightGrams, unit, { withUnit: false })} unit={unit} />
            <Stat label="e1RM" value={d.bests.estimated1rmGrams ? formatWeight(Math.round(d.bests.estimated1rmGrams / 100) * 100, unit, { withUnit: false }) : "–"} unit={d.bests.estimated1rmGrams ? `${unit} ≈` : undefined} />
            <Stat label="Bestes Volumen" value={formatTonnage(d.bests.maxSessionVolumeGrams, unit)} />
          </View>
        </Card>
        {r ? (
          <Section title="Empfehlung fürs nächste Mal">
            <Card tone={r.action === "increase" ? "accent" : "muted"}>
              <Text variant="bodyStrong">
                {r.action === "increase" ? `Steigern auf ${formatWeight(r.suggestedWeightGrams, unit)}` : r.action === "decrease" ? `Zurück auf ${formatWeight(r.suggestedWeightGrams, unit)}` : r.action === "add_reps" ? `${formatWeight(r.suggestedWeightGrams, unit)} halten, ${r.suggestedReps} Wdh. anpeilen` : r.action === "hold" ? `${formatWeight(r.suggestedWeightGrams, unit)} halten` : "Noch keine Empfehlung"}
              </Text>
              <Text variant="callout" color="secondary" style={{ marginTop: 4 }}>
                {r.reason}
              </Text>
            </Card>
          </Section>
        ) : null}
        <Section title="Einheiten">
          <Card padding="none">
            {[...d.points].reverse().map((p, i, arr) => (
              <ListRow key={p.workoutId} title={`${formatWeight(p.topWeightGrams, unit)} × ${p.topReps}`} subtitle={`${p.workingSets} Sätze · ${formatTonnage(p.tonnageGrams, unit)}`} value={formatDate(p.performedAt)} last={i === arr.length - 1} />
            ))}
          </Card>
        </Section>
      </Screen>
    </>
  )
}
