import { Alert, View } from "react-native"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { EQUIPMENT_LABELS, MUSCLE_GROUPS } from "@pondus/shared"
import { Button, Card, Chip, ErrorState, LineChart, ListRow, LoadingState, Screen, Section, Text, useTheme } from "@/design-system"
import { useAlternatives, useDeleteExercise, useExercise, useExerciseHistory, useToggleFavorite } from "@/features/exercises/queries"
import { useExerciseProgress } from "@/features/progress/queries"
import { ExerciseAnimation } from "@/components/ExerciseMedia"
import { useSettingsStore } from "@/services/settings-store"
import { CATEGORY_LABELS, DIFFICULTY_LABELS, formatDate, formatWeight } from "@/lib/format"
import { gramsToUnit } from "@pondus/shared"

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { space } = useTheme()
  const router = useRouter()
  const unit = useSettingsStore(s => s.weightUnit)
  const q = useExercise(id)
  const alternatives = useAlternatives(id)
  const history = useExerciseHistory(id)
  const progress = useExerciseProgress(id, "12w")
  const fav = useToggleFavorite()
  const del = useDeleteExercise()
  if (q.isLoading) return <LoadingState />
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />
  const e = q.data
  const muscle = (m: string) => MUSCLE_GROUPS.find(g => g.slug === m)?.nameDe ?? m
  const points = (progress.data?.points ?? []).map(p => ({ label: formatDate(p.performedAt), value: Math.round(gramsToUnit(p.topWeightGrams, unit) * 10) / 10, caption: `${p.topReps} Wdh.` }))

  return (
    <>
      <Stack.Screen
        options={{
          title: e.nameDe,
          headerLargeTitle: false,
          headerRight: () => <Button title={e.isFavorite ? "♥" : "♡"} variant="ghost" size="sm" onPress={() => fav.mutate({ id: e.id, favorite: !e.isFavorite })} />,
        }}
      />
      <Screen>
        <ExerciseAnimation slug={e.slug} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          <Chip label={CATEGORY_LABELS[e.category] ?? e.category} size="sm" tone="accent" />
          <Chip label={DIFFICULTY_LABELS[e.difficulty] ?? e.difficulty} size="sm" />
          {e.isUnilateral ? <Chip label="Einseitig" size="sm" /> : null}
          {!e.isSystem ? <Chip label="Eigene Übung" size="sm" /> : null}
        </View>
        <Card>
          <Text variant="callout" color="secondary">
            {e.nameEn !== e.nameDe ? `${e.nameEn} · ` : ""}
            {e.aliases.length ? `auch: ${e.aliases.join(", ")}` : ""}
          </Text>
          {e.description ? (
            <Text variant="body" style={{ marginTop: space[2] }}>
              {e.description}
            </Text>
          ) : null}
        </Card>
        <Card padding="none">
          <ListRow title="Hauptmuskeln" value={e.primaryMuscles.map(muscle).join(", ")} />
          <ListRow title="Nebenmuskeln" value={e.secondaryMuscles.length ? e.secondaryMuscles.map(muscle).join(", ") : "–"} />
          <ListRow title="Equipment" value={e.equipment.map(x => EQUIPMENT_LABELS[x].de).join(", ")} last />
        </Card>
        {e.cues.length ? (
          <Section title="Ausführung">
            <Card>
              {e.cues.map((c, i) => (
                <Text key={i} variant="callout" style={{ marginBottom: 4 }}>
                  • {c}
                </Text>
              ))}
            </Card>
          </Section>
        ) : null}
        {e.commonMistakes.length ? (
          <Section title="Häufige Fehler">
            <Card>
              {e.commonMistakes.map((c, i) => (
                <Text key={i} variant="callout" color="secondary" style={{ marginBottom: 4 }}>
                  • {c}
                </Text>
              ))}
            </Card>
          </Section>
        ) : null}

        <Section title="Entwicklung (12 Wochen)" action={<Button title="Mehr" variant="ghost" size="sm" onPress={() => router.push(`/(tabs)/progress/exercise/${e.id}`)} />}>
          <Card>
            <LineChart data={points} formatValue={v => `${v} ${unit}`} emptyLabel="Noch keine Trainingsdaten" />
            {progress.data?.recommendation ? (
              <Text variant="callout" color="secondary" style={{ marginTop: space[2] }}>
                {progress.data.recommendation.reason}
              </Text>
            ) : null}
          </Card>
        </Section>

        <Section title="Letzte Einheiten">
          {history.data?.items.length ? (
            <Card padding="none">
              {history.data.items.slice(0, 5).map((h, i, arr) => (
                <ListRow key={h.workoutId} title={h.workoutName} subtitle={h.sets.filter(s => s.setType !== "warmup").map(s => `${formatWeight(s.weightGrams, unit, { withUnit: false })}×${s.reps}`).join("  ")} value={formatDate(h.completedAt)} onPress={() => router.push(`/(tabs)/progress/workout/${h.workoutId}`)} last={i === arr.length - 1} />
              ))}
            </Card>
          ) : (
            <Text variant="footnote" color="tertiary">
              Noch nicht trainiert.
            </Text>
          )}
        </Section>

        <Section title="Alternativen">
          {alternatives.data?.length ? (
            <Card padding="none">
              {alternatives.data.slice(0, 6).map((a, i, arr) => (
                <ListRow key={a.exercise.id} title={a.exercise.nameDe} subtitle={a.reasons.join(" · ")} onPress={() => router.push(`/(tabs)/exercises/${a.exercise.id}`)} last={i === arr.length - 1} />
              ))}
            </Card>
          ) : (
            <Text variant="footnote" color="tertiary">
              Keine passenden Alternativen für dein Equipment.
            </Text>
          )}
        </Section>
        {!e.isSystem ? (
          <Button title="Übung löschen" variant="danger" onPress={() => Alert.alert("Übung löschen?", "Vergangene Workouts behalten ihre Daten.", [{ text: "Abbrechen", style: "cancel" }, { text: "Löschen", style: "destructive", onPress: () => del.mutate(e.id, { onSuccess: () => router.back(), onError: err => Alert.alert("Nicht möglich", err instanceof Error ? err.message : "") }) }])} />
        ) : null}
      </Screen>
    </>
  )
}
