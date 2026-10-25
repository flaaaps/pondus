import { useMemo, useState } from "react"
import { RefreshControl, View } from "react-native"
import { useRouter } from "expo-router"
import { MUSCLE_GROUPS, gramsToUnit } from "@pondus/shared"
import { BarChart, Button, Card, EmptyState, ErrorState, ListRow, LoadingState, Screen, Section, SegmentedControl, Stat, Text, useTheme } from "@/design-system"
import { useOverview, useWorkoutHistory, type Range } from "@/features/progress/queries"
import { useSettingsStore } from "@/services/settings-store"
import { formatDate, formatDuration, formatTonnage, relativeDay, RECORD_TYPE_LABELS, formatRecordValue } from "@/lib/format"

export default function ProgressScreen() {
  const { space, colors } = useTheme()
  const router = useRouter()
  const unit = useSettingsStore(s => s.weightUnit)
  const [range, setRange] = useState<Range>("12w")
  const [metric, setMetric] = useState<"tonnage" | "sets" | "workouts" | "duration">("tonnage")
  const overview = useOverview(range)
  const history = useWorkoutHistory()
  const items = useMemo(() => history.data?.pages.flatMap(p => p.items) ?? [], [history.data])
  const [refreshing, setRefreshing] = useState(false)
  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([overview.refetch(), history.refetch()])
    setRefreshing(false)
  }

  if (!overview.data) return overview.isError ? <ErrorState onRetry={() => void overview.refetch()} /> : <LoadingState />
  const o = overview.data
  const chart = o.weeklyVolume.map(w => ({
    label: formatDate(`${w.weekStart}T12:00:00`, { day: "numeric", month: "numeric" }),
    value: metric === "tonnage" ? Math.round(gramsToUnit(w.tonnageGrams, unit)) : metric === "sets" ? w.workingSets : metric === "workouts" ? w.workouts : Math.round(w.durationSeconds / 60),
  }))
  const fmt = (v: number) => (metric === "tonnage" ? formatTonnage(unit === "kg" ? v * 1000 : v * 453.59237, unit) : metric === "duration" ? `${v} min` : String(v))
  const totalSets = o.muscleDistribution.reduce((a, m) => a + m.workingSets, 0)

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}>
      <SegmentedControl options={[{ value: "4w", label: "4 W" }, { value: "8w", label: "8 W" }, { value: "12w", label: "12 W" }, { value: "6m", label: "6 M" }, { value: "1y", label: "1 J" }]} value={range === "all" ? "1y" : range} onChange={setRange} />

      {o.totalWorkouts === 0 ? (
        <EmptyState icon="chart.bar" title="Noch keine Daten" body="Nach deinem ersten Workout siehst du hier Volumen, Häufigkeit und Bestleistungen." actionTitle="Zum Plan" onAction={() => router.push("/(tabs)/plan")} />
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: "row", gap: space[3] }}>
              <Stat label="Diese Woche" value={`${o.workoutsThisWeek}${o.plannedThisWeek ? `/${o.plannedThisWeek}` : ""}`} />
              <Stat label="Serie" value={String(o.currentStreakWeeks)} unit="Wo." />
              <Stat label="Workouts" value={String(o.totalWorkouts)} />
            </View>
          </Card>

          <Section title="Pro Woche">
            <Card>
              <SegmentedControl options={[{ value: "tonnage", label: "Volumen" }, { value: "sets", label: "Sätze" }, { value: "workouts", label: "Einheiten" }, { value: "duration", label: "Dauer" }]} value={metric} onChange={setMetric} />
              <View style={{ height: space[3] }} />
              <BarChart data={chart} formatValue={fmt} />
              <Text variant="footnote" color="tertiary" style={{ marginTop: space[2] }}>
                {metric === "tonnage" ? "Bewegtes Gewicht = Gewicht × Wiederholungen aller Arbeitssätze. Aufwärmsätze zählen nicht." : metric === "sets" ? "Abgeschlossene Arbeitssätze pro Woche." : metric === "workouts" ? "Abgeschlossene Einheiten pro Woche." : "Trainingszeit ohne Pausen."}
              </Text>
            </Card>
          </Section>

          {o.muscleWeeklySets?.length ? (
            <Section title="Diese Woche: Sätze vs. Ziel">
              <Card>
                {o.muscleWeeklySets.map(m => {
                  const fmtSets = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1 })
                  const reached = m.targetSets > 0 && m.actualSets >= m.targetSets
                  const scaleMax = Math.max(m.targetSets, m.actualSets, 1)
                  return (
                    <View key={m.muscle} accessible accessibilityLabel={`${m.label}: ${fmtSets(m.actualSets)} von ${fmtSets(m.targetSets)} Sätzen${reached ? ", Ziel erreicht" : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[2] }}>
                      <Text variant="callout" style={{ width: 110 }} numberOfLines={1}>
                        {m.label}
                      </Text>
                      <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.chartMuted, overflow: "hidden" }}>
                        <View style={{ width: `${(m.actualSets / scaleMax) * 100}%`, height: "100%", backgroundColor: reached ? colors.success : colors.chartPrimary }} />
                        {m.targetSets > 0 ? <View style={{ position: "absolute", left: `${(m.targetSets / scaleMax) * 100}%`, marginLeft: -1, top: 0, bottom: 0, width: 2, backgroundColor: colors.textPrimary }} /> : null}
                      </View>
                      <Text variant="caption" color={reached ? "success" : "secondary"} style={{ width: 56, textAlign: "right" }} numberOfLines={1}>
                        {fmtSets(m.actualSets)}/{fmtSets(m.targetSets)}
                      </Text>
                    </View>
                  )
                })}
                <Text variant="footnote" color="tertiary">
                  Abgeschlossene Arbeitssätze dieser Woche gegen das Wochenziel deines Plans (Strich). Nebenmuskeln zählen halb.
                </Text>
              </Card>
            </Section>
          ) : null}

          {o.muscleDistribution.length ? (
            <Section title="Muskelgruppen">
              <Card>
                {o.muscleDistribution.slice(0, 8).map(m => (
                  <View key={m.muscle} style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[2] }}>
                    <Text variant="callout" style={{ width: 110 }} numberOfLines={1}>
                      {MUSCLE_GROUPS.find(g => g.slug === m.muscle)?.nameDe ?? m.muscle}
                    </Text>
                    <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.chartMuted, overflow: "hidden" }}>
                      <View style={{ width: `${totalSets ? (m.workingSets / totalSets) * 100 : 0}%`, height: "100%", backgroundColor: colors.chartPrimary }} />
                    </View>
                    <Text variant="caption" color="secondary" style={{ width: 44, textAlign: "right" }}>
                      {m.workingSets}
                    </Text>
                  </View>
                ))}
                <Text variant="footnote" color="tertiary">
                  Arbeitssätze im Zeitraum; Nebenmuskeln zählen halb.
                </Text>
              </Card>
            </Section>
          ) : null}

          <Section title="Bestleistungen" action={<Button title="Alle" variant="ghost" size="sm" onPress={() => router.push("/(tabs)/progress/records")} />}>
            {o.recentRecords.length ? (
              <Card padding="none">
                {o.recentRecords.slice(0, 5).map((r, i, arr) => (
                  <ListRow key={`${r.exerciseName}-${r.type}-${r.achievedAt}`} title={r.exerciseName} subtitle={`${RECORD_TYPE_LABELS[r.type]}${r.isEstimate ? " (Schätzung)" : ""} · ${relativeDay(r.achievedAt)}`} value={formatRecordValue(r, unit)} onPress={r.exerciseId ? () => router.push(`/(tabs)/progress/exercise/${r.exerciseId}`) : undefined} last={i === arr.length - 1} />
                ))}
              </Card>
            ) : (
              <Text variant="footnote" color="tertiary">
                Noch keine Bestleistungen erkannt.
              </Text>
            )}
          </Section>

          <Section title="Trainingshistorie">
            <Card padding="none">
              {items.map((w, i, arr) => (
                <ListRow key={w.id} title={w.name} subtitle={`${formatDuration(w.durationSeconds)} · ${w.exerciseCount} Übungen · ${w.workingSets} Sätze · ${formatTonnage(w.tonnageGrams, unit)}`} value={relativeDay(w.completedAt ?? w.startedAt)} onPress={() => router.push(`/(tabs)/progress/workout/${w.id}`)} last={i === arr.length - 1} />
              ))}
            </Card>
            {history.hasNextPage ? <Button title="Mehr laden" variant="secondary" fullWidth loading={history.isFetchingNextPage} onPress={() => void history.fetchNextPage()} /> : null}
          </Section>
        </>
      )}
    </Screen>
  )
}
