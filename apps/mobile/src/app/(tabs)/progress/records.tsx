import { Stack, useRouter } from "expo-router"
import { Card, EmptyState, ErrorState, ListRow, LoadingState, Screen, Text } from "@/design-system"
import { useRecords } from "@/features/progress/queries"
import { useSettingsStore } from "@/services/settings-store"
import { formatDate, RECORD_TYPE_LABELS, formatRecordValue } from "@/lib/format"

export default function RecordsScreen() {
  const router = useRouter()
  const unit = useSettingsStore(s => s.weightUnit)
  const q = useRecords()
  if (q.isLoading) return <LoadingState />
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />
  return (
    <>
      <Stack.Screen options={{ title: "Bestleistungen", headerLargeTitle: false }} />
      <Screen>
        {q.data.items.length ? (
          <Card padding="none">
            {q.data.items.map((r, i, arr) => (
              <ListRow key={r.id} title={r.exerciseName} subtitle={`${RECORD_TYPE_LABELS[r.type]}${r.isEstimate ? " (Schätzung)" : ""} · ${formatDate(r.achievedAt)}`} value={formatRecordValue(r, unit)} onPress={r.workoutId ? () => router.push(`/(tabs)/progress/workout/${r.workoutId}`) : undefined} last={i === arr.length - 1} />
            ))}
          </Card>
        ) : (
          <EmptyState icon="trophy" title="Noch keine Bestleistungen" body="Sobald du eine Übung zum zweiten Mal trainierst, erkennen wir neue Maximalgewichte, Wiederholungs- und Volumenrekorde." />
        )}
        <Text variant="footnote" color="tertiary">
          Verglichen werden nur Arbeitssätze derselben Übung. Geschätzte 1RM-Werte sind als Schätzung markiert.
        </Text>
      </Screen>
    </>
  )
}
