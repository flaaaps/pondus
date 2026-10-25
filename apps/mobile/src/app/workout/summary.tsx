import { View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { tonnageGrams, totalReps, workingSetCount } from "@pondus/shared"
import { Button, Card, ListRow, LoadingState, Screen, Section, Stat, Text, useTheme } from "@/design-system"
import { useWorkoutSummary } from "@/features/progress/queries"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useSettingsStore } from "@/services/settings-store"
import { activeWorkoutStorage } from "@/storage/active-workout"
import { formatDuration, formatTonnage, formatWeight, RECORD_TYPE_LABELS } from "@/lib/format"

/**
 * Post-workout summary. Uses the server summary (records, comparison) when
 * the completion has synced; otherwise shows locally computed numbers and
 * says that records will appear after sync.
 */
export default function SummaryScreen() {
  const { id, local } = useLocalSearchParams<{ id: string; local: string; clientId: string }>()
  const { space } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const unit = useSettingsStore(s => s.weightUnit)
  const serverIdFromStore = useActiveWorkoutStore(s => s.serverId)
  const pending = useActiveWorkoutStore(s => s.pending)
  const serverId = id || (pending === 0 ? serverIdFromStore : null) || undefined
  const summary = useWorkoutSummary(serverId)
  const localWorkout = activeWorkoutStorage.loadLastCompleted()

  const s = summary.data
  const w = s?.workout ?? localWorkout
  if (!w) return <LoadingState />
  const sets = w.exercises.filter(e => !e.skipped).flatMap(e => e.sets.map(x => ({ setType: x.setType, weightGrams: x.weightGrams, reps: x.reps, completed: x.completed })))
  const duration = s?.durationSeconds ?? w.durationSeconds ?? 0
  const workingSets = s?.workingSets ?? workingSetCount(sets)
  const reps = s?.totalReps ?? totalReps(sets)
  const tonnage = s?.tonnageGrams ?? tonnageGrams(sets)
  const exercisesDone = w.exercises.filter(e => !e.skipped && e.sets.some(x => x.completed)).length

  return (
    <Screen title="Geschafft!" subtitle={w.name} contentStyle={{ paddingTop: insets.top + space[4] }}>
      <Card tone="strong" padding="lg">
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <Stat label="Dauer" value={formatDuration(duration)} tone="primary" />
          <Stat label="Arbeitssätze" value={String(workingSets)} />
        </View>
        <View style={{ height: space[3] }} />
        <View style={{ flexDirection: "row", gap: space[3] }}>
          <Stat label="Wiederholungen" value={String(reps)} />
          <Stat label="Bewegt" value={formatTonnage(tonnage, unit)} tone="accent" />
        </View>
        <Text variant="footnote" color="inverse" style={{ opacity: 0.7, marginTop: space[3] }}>
          {exercisesDone} Übungen · Bewegtes Gewicht = Gewicht × Wiederholungen aller Arbeitssätze.
        </Text>
      </Card>

      {s ? (
        <>
          {s.records.length ? (
            <Section title="Neue Bestleistungen">
              <Card padding="none">
                {s.records.map((r, i, arr) => (
                  <ListRow key={`${r.exerciseName}-${r.type}`} title={r.exerciseName} subtitle={`${RECORD_TYPE_LABELS[r.type]}${r.isEstimate ? " (Schätzung)" : ""}`} value={r.type === "max_reps_at_weight" ? `${r.reps} × ${formatWeight(r.weightGrams, unit)}` : formatWeight(r.valueGrams ?? r.weightGrams, unit)} last={i === arr.length - 1} />
                ))}
              </Card>
            </Section>
          ) : (
            <Text variant="callout" color="secondary">
              Keine neuen Bestleistungen – solide Arbeit zählt genauso.
            </Text>
          )}
          {s.comparison ? (
            <Section title="Im Vergleich zum letzten Mal">
              <Card>
                <Text variant="callout">
                  {s.workingSets - s.comparison.workingSets >= 0 ? "+" : ""}
                  {s.workingSets - s.comparison.workingSets} Arbeitssätze · {s.tonnageGrams >= s.comparison.tonnageGrams ? "+" : "−"}
                  {formatTonnage(Math.abs(s.tonnageGrams - s.comparison.tonnageGrams), unit)} Volumen · {s.comparison.durationSeconds !== null ? `${duration - s.comparison.durationSeconds >= 0 ? "+" : "−"}${formatDuration(Math.abs(duration - s.comparison.durationSeconds))}` : ""}
                </Text>
              </Card>
            </Section>
          ) : null}
        </>
      ) : summary.isLoading && serverId ? (
        <LoadingState label="Bestleistungen werden ausgewertet" />
      ) : (
        <Card tone="muted">
          <Text variant="calloutStrong">{local === "1" || pending ? "Offline gespeichert" : "Auswertung folgt"}</Text>
          <Text variant="footnote" color="secondary">
            Dein Workout ist lokal gesichert und wird synchronisiert, sobald eine Verbindung besteht. Bestleistungen und Vergleiche erscheinen danach in der Historie.
          </Text>
        </Card>
      )}

      <Section title="Übungen">
        <Card padding="none">
          {w.exercises
            .filter(e => !e.skipped)
            .map((e, i, arr) => (
              <ListRow key={e.id} title={e.exerciseNameSnapshot} subtitle={e.sets.filter(x => x.completed && x.setType !== "warmup").map(x => `${formatWeight(x.weightGrams, unit, { withUnit: false })}×${x.reps ?? "–"}`).join("  ") || "–"} last={i === arr.length - 1} />
            ))}
        </Card>
      </Section>
      <Button title="Fertig" fullWidth onPress={() => router.replace("/(tabs)")} hapticStyle="medium" />
    </Screen>
  )
}
