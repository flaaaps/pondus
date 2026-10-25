import { useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { MUSCLE_GROUPS } from "@pondus/shared"
import { OnboardingShell } from "@/components/OnboardingShell"
import { useOnboardingDraft } from "@/features/onboarding/draft-store"
import { useUpdateExercisePreferences, useUpdateProfile, useUpdateUser } from "@/features/profile/queries"
import { useGeneratePlan } from "@/features/plans/queries"
import { Card, ListRow, Text } from "@/design-system"
import { ENVIRONMENT_LABELS, EXPERIENCE_LABELS, GOAL_LABELS } from "@/lib/format"
import { ApiError } from "@/lib/api-client"
import { errorMessage } from "@/lib/errors"

export default function SummaryScreen() {
  const d = useOnboardingDraft()
  const router = useRouter()
  const updateProfile = useUpdateProfile()
  const updatePrefs = useUpdateExercisePreferences()
  const updateUser = useUpdateUser()
  const generate = useGeneratePlan()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const finish = async () => {
    setBusy(true)
    setError(null)
    try {
      await updateProfile.mutateAsync({
        primaryGoal: d.goals[0] ?? "hypertrophy",
        secondaryGoals: d.goals.slice(1),
        experienceLevel: d.experienceLevel,
        weeklyFrequency: d.weeklyFrequency,
        sessionDurationMinutes: d.sessionDurationMinutes,
        environment: d.environment,
        availableEquipment: d.availableEquipment,
        preferredWeekdays: d.preferredWeekdays.length === d.weeklyFrequency ? d.preferredWeekdays : [],
        musclePriorities: d.focusMuscles.map((muscle, i) => ({ muscle, priority: i + 1 })),
      })
      await updatePrefs.mutateAsync({ preferred: d.preferred, excluded: d.excluded })
      await generate.mutateAsync({ activate: true })
      await updateUser.mutateAsync({ onboardingCompleted: true })
      d.reset()
      router.replace("/(tabs)/plan")
    } catch (err) {
      setError(err instanceof ApiError && err.isNetwork ? "Keine Verbindung. Zum Erstellen des ersten Plans brauchst du einmal Internet." : errorMessage(err, "Das hat nicht geklappt."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <OnboardingShell step="summary" title="Dein Trainingsprofil" body="Alles kannst du später im Profil ändern – ohne deine Trainingshistorie zu verlieren." nextTitle="Plan erstellen" onNext={() => void finish()} loading={busy}>
      <Card padding="none">
        <ListRow title="Ziel" value={d.goals.map(g => GOAL_LABELS[g]).join(", ")} />
        <ListRow title="Erfahrung" value={EXPERIENCE_LABELS[d.experienceLevel]} />
        <ListRow title="Häufigkeit" value={`${d.weeklyFrequency}× pro Woche`} />
        <ListRow title="Dauer" value={`${d.sessionDurationMinutes} min`} />
        <ListRow title="Umgebung" value={ENVIRONMENT_LABELS[d.environment]} />
        <ListRow title="Schwerpunkte" value={d.focusMuscles.length ? d.focusMuscles.map(m => MUSCLE_GROUPS.find(g => g.slug === m)!.nameDe).join(", ") : "Keine"} />
        <ListRow title="Übungen" value={`${d.preferred.length} bevorzugt · ${d.excluded.length} ausgeschlossen`} last />
      </Card>
      {error ? (
        <View>
          <Text variant="callout" color="danger">
            {error}
          </Text>
        </View>
      ) : null}
    </OnboardingShell>
  )
}
