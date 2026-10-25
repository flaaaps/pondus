import { useMemo, useState } from "react"
import { View } from "react-native"
import { MUSCLE_GROUPS, type MuscleSlug } from "@pondus/shared"
import { OnboardingShell } from "@/components/OnboardingShell"
import { useOnboardingDraft } from "@/features/onboarding/draft-store"
import { useAllExercises } from "@/features/exercises/queries"
import { Card, Chip, LoadingState, Text, useTheme } from "@/design-system"
import { ExercisePreferenceRow } from "@/components/ExercisePreferenceRow"

/**
 * Preferred / neutral / excluded per exercise, browsed by muscle group so a
 * user can quickly build a shortlist from several areas instead of starring
 * a flat list.
 */
export default function ExercisesScreen() {
  const { space } = useTheme()
  const d = useOnboardingDraft()
  const [muscle, setMuscle] = useState<MuscleSlug>(d.focusMuscles[0] ?? "chest")
  const { data, isLoading } = useAllExercises()
  const available = useMemo(() => new Set(d.availableEquipment), [d.availableEquipment])
  const list = useMemo(
    () =>
      (data ?? [])
        .filter(e => e.primaryMuscles.includes(muscle) && !["cardio", "mobility", "warmup"].includes(e.category) && e.equipment.every(x => available.has(x)))
        .sort((a, b) => (a.category === "compound" ? 0 : 1) - (b.category === "compound" ? 0 : 1) || a.nameDe.localeCompare(b.nameDe, "de")),
    [data, muscle, available],
  )
  const prefOf = (id: string) => (d.preferred.includes(id) ? "preferred" : d.excluded.includes(id) ? "excluded" : "neutral")
  return (
    <OnboardingShell step="exercises" title="Welche Übungen magst du?" body="Optional. Markiere Lieblingsübungen und solche, die du nicht machen willst. Der Plan bevorzugt deine Auswahl, bleibt aber ausgewogen." nextHref="/(onboarding)/summary">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {MUSCLE_GROUPS.map(g => (
          <Chip key={g.slug} label={g.nameDe} size="sm" selected={muscle === g.slug} onPress={() => setMuscle(g.slug)} />
        ))}
      </View>
      <Text variant="footnote" color="tertiary">
        {d.preferred.length} bevorzugt · {d.excluded.length} ausgeschlossen
      </Text>
      {isLoading ? (
        <LoadingState />
      ) : (
        <Card padding="none">
          {list.map((e, i) => (
            <ExercisePreferenceRow key={e.id} exercise={e} value={prefOf(e.id)} onChange={v => d.setPreference(e.id, v)} last={i === list.length - 1} />
          ))}
        </Card>
      )}
    </OnboardingShell>
  )
}
