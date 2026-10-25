import { useMemo, useState } from "react"
import { Alert, View } from "react-native"
import { Stack } from "expo-router"
import { MUSCLE_GROUPS, type MuscleSlug } from "@pondus/shared"
import { Button, Card, Chip, ErrorState, LoadingState, Screen, Text, useTheme } from "@/design-system"
import { useAllExercises } from "@/features/exercises/queries"
import { useExercisePreferences, useProfile, useUpdateExercisePreferences } from "@/features/profile/queries"
import { ExercisePreferenceRow } from "@/components/ExercisePreferenceRow"

export default function PreferencesScreen() {
  const { space } = useTheme()
  const prefs = useExercisePreferences()
  const profile = useProfile()
  const exercises = useAllExercises()
  const update = useUpdateExercisePreferences()
  const [muscle, setMuscle] = useState<MuscleSlug>("chest")
  const [draft, setDraft] = useState<{ preferred: string[]; excluded: string[] } | null>(null)
  const cur = draft ?? prefs.data ?? { preferred: [], excluded: [] }
  const available = useMemo(() => new Set<string>(profile.data?.availableEquipment ?? []), [profile.data])
  const list = useMemo(
    () => (exercises.data ?? []).filter(e => e.primaryMuscles.includes(muscle) && !["cardio", "mobility", "warmup"].includes(e.category) && (available.size === 0 || e.equipment.every((x: string) => available.has(x)))).sort((a, b) => (a.category === "compound" ? 0 : 1) - (b.category === "compound" ? 0 : 1) || a.nameDe.localeCompare(b.nameDe, "de")),
    [exercises.data, muscle, available],
  )
  if (prefs.isLoading || exercises.isLoading) return <LoadingState />
  if (!prefs.data) return <ErrorState onRetry={() => void prefs.refetch()} />
  const setPref = (id: string, v: "preferred" | "excluded" | "neutral") =>
    setDraft({ preferred: v === "preferred" ? [...new Set([...cur.preferred, id])] : cur.preferred.filter(x => x !== id), excluded: v === "excluded" ? [...new Set([...cur.excluded, id])] : cur.excluded.filter(x => x !== id) })
  return (
    <>
      <Stack.Screen options={{ title: "Übungspräferenzen", headerLargeTitle: false, headerRight: () => (draft ? <Button title="Speichern" size="sm" variant="ghost" loading={update.isPending} onPress={() => update.mutate(cur, { onSuccess: () => setDraft(null), onError: e => Alert.alert("Fehler", e instanceof Error ? e.message : "") })} /> : null) }} />
      <Screen>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {MUSCLE_GROUPS.map(g => (
            <Chip key={g.slug} label={g.nameDe} size="sm" selected={muscle === g.slug} onPress={() => setMuscle(g.slug)} />
          ))}
        </View>
        <Text variant="footnote" color="tertiary">
          {cur.preferred.length} bevorzugt · {cur.excluded.length} ausgeschlossen. Bevorzugte Übungen werden bei der Planung höher bewertet, ausgeschlossene nie vorgeschlagen.
        </Text>
        <Card padding="none">
          {list.map((e, i) => (
            <ExercisePreferenceRow key={e.id} exercise={e} value={cur.preferred.includes(e.id) ? "preferred" : cur.excluded.includes(e.id) ? "excluded" : "neutral"} onChange={v => setPref(e.id, v)} last={i === list.length - 1} />
          ))}
        </Card>
      </Screen>
    </>
  )
}
