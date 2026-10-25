import { View } from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { Button, Card, ErrorState, ListRow, LoadingState, Screen, Section, Stat, Text, useTheme } from "@/design-system"
import { useWorkout, useWorkoutSummary } from "@/features/progress/queries"
import { useStartWorkout } from "@/features/workout/use-start-workout"
import { useSettingsStore } from "@/services/settings-store"
import { formatDateTime, formatDuration, formatTonnage, formatWeight, RECORD_TYPE_LABELS, SET_TYPE_LABELS } from "@/lib/format"

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { space } = useTheme()
  const router = useRouter()
  const unit = useSettingsStore(s => s.weightUnit)
  const w = useWorkout(id)
  const summary = useWorkoutSummary(w.data?.status === "completed" ? id : undefined)
  const { repeat, starting } = useStartWorkout()
  if (w.isLoading) return <LoadingState />
  if (w.isError || !w.data) return <ErrorState onRetry={() => void w.refetch()} />
  const workout = w.data
  const s = summary.data
  return (
    <>
      <Stack.Screen options={{ title: workout.name, headerLargeTitle: false }} />
      <Screen>
        <Text variant="callout" color="secondary">
          {formatDateTime(workout.startedAt)}
          {workout.status !== "completed" ? ` · ${workout.status === "cancelled" ? "abgebrochen" : "läuft"}` : ""}
        </Text>
        {s ? (
          <Card>
            <View style={{ flexDirection: "row", gap: space[3] }}>
              <Stat label="Dauer" value={formatDuration(s.durationSeconds)} />
              <Stat label="Sätze" value={String(s.workingSets)} />
              <Stat label="Volumen" value={formatTonnage(s.tonnageGrams, unit)} />
            </View>
            {s.comparison ? (
              <Text variant="footnote" color="secondary" style={{ marginTop: space[3] }}>
                Vergleich zur letzten „{workout.name}“: {s.workingSets - s.comparison.workingSets >= 0 ? "+" : ""}
                {s.workingSets - s.comparison.workingSets} Sätze, {s.tonnageGrams - s.comparison.tonnageGrams >= 0 ? "+" : "−"}
                {formatTonnage(Math.abs(s.tonnageGrams - s.comparison.tonnageGrams), unit)} Volumen.
              </Text>
            ) : null}
          </Card>
        ) : null}
        {s?.records.length ? (
          <Section title="Bestleistungen in dieser Einheit">
            <Card padding="none">
              {s.records.map((r, i, arr) => (
                <ListRow key={`${r.exerciseName}-${r.type}`} title={r.exerciseName} subtitle={`${RECORD_TYPE_LABELS[r.type]}${r.isEstimate ? " (Schätzung)" : ""}`} value={r.type === "max_reps_at_weight" ? `${r.reps} × ${formatWeight(r.weightGrams, unit)}` : formatWeight(r.valueGrams ?? r.weightGrams, unit)} last={i === arr.length - 1} />
              ))}
            </Card>
          </Section>
        ) : null}
        <Section title="Übungen">
          {workout.exercises
            .filter(e => !e.skipped)
            .map(e => (
              <Card key={e.id} padding="sm" onPress={e.exerciseId ? () => router.push(`/(tabs)/exercises/${e.exerciseId}`) : undefined}>
                <Text variant="bodyStrong" style={{ marginBottom: space[1] }}>
                  {e.exerciseNameSnapshot}
                </Text>
                {e.sets.map(set => (
                  <View key={set.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
                    <Text variant="callout" color="secondary">
                      {set.setNumber}. {SET_TYPE_LABELS[set.setType]}
                    </Text>
                    <Text variant="callout">
                      {formatWeight(set.weightGrams, unit)} × {set.reps ?? "–"}
                      {set.rir !== null ? `  RIR ${set.rir}` : ""}
                    </Text>
                  </View>
                ))}
                {e.notes ? (
                  <Text variant="footnote" color="tertiary">
                    {e.notes}
                  </Text>
                ) : null}
              </Card>
            ))}
        </Section>
        {workout.notes ? (
          <Card tone="muted">
            <Text variant="callout">{workout.notes}</Text>
          </Card>
        ) : null}
        {workout.status === "completed" ? <Button title="Als Vorlage für neues Workout" variant="secondary" fullWidth loading={starting} onPress={() => void repeat(workout)} /> : null}
      </Screen>
    </>
  )
}
