import { useState } from "react"
import { Alert, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { EXPERIENCE_LEVELS, GOALS, type ExperienceLevel, type Goal } from "@pondus/shared"
import { Button, Chip, ErrorState, LoadingState, Screen, Section, Text, useTheme } from "@/design-system"
import { useProfile, useUpdateProfile } from "@/features/profile/queries"
import { EXPERIENCE_LABELS, GOAL_LABELS, WEEKDAYS_SHORT } from "@/lib/format"

export default function EditProfileScreen() {
  const { space } = useTheme()
  const router = useRouter()
  const profile = useProfile()
  const update = useUpdateProfile()
  if (profile.isLoading) return <LoadingState />
  if (!profile.data) return <ErrorState onRetry={() => void profile.refetch()} />
  return <Form initial={profile.data} onSave={body => update.mutate(body, { onSuccess: () => router.back(), onError: e => Alert.alert("Speichern fehlgeschlagen", e instanceof Error ? e.message : "") })} saving={update.isPending} />

  function Form({ initial, onSave, saving }: { initial: NonNullable<typeof profile.data>; onSave: (b: { primaryGoal: Goal; secondaryGoals: Goal[]; experienceLevel: ExperienceLevel; weeklyFrequency: number; sessionDurationMinutes: number; preferredWeekdays: number[] }) => void; saving: boolean }) {
    const [goals, setGoals] = useState<Goal[]>([initial.primaryGoal, ...initial.secondaryGoals])
    const [level, setLevel] = useState<ExperienceLevel>(initial.experienceLevel)
    const [freq, setFreq] = useState(initial.weeklyFrequency)
    const [dur, setDur] = useState(initial.sessionDurationMinutes)
    const [days, setDays] = useState<number[]>(initial.preferredWeekdays)
    const toggleGoal = (g: Goal) => setGoals(gs => (gs.includes(g) ? (gs.length > 1 ? gs.filter(x => x !== g) : gs) : [...gs, g].slice(0, 3)))
    return (
      <>
        <Stack.Screen options={{ title: "Profil bearbeiten", headerLargeTitle: false }} />
        <Screen>
          <Section title="Ziele (erstes = Hauptziel)">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{GOALS.map(g => <Chip key={g} label={`${goals[0] === g ? "★ " : ""}${GOAL_LABELS[g]}`} selected={goals.includes(g)} onPress={() => toggleGoal(g)} />)}</View>
          </Section>
          <Section title="Erfahrung">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{EXPERIENCE_LEVELS.map(l => <Chip key={l} label={EXPERIENCE_LABELS[l]!} selected={level === l} onPress={() => setLevel(l)} />)}</View>
          </Section>
          <Section title="Häufigkeit">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{[2, 3, 4, 5, 6].map(n => <Chip key={n} label={`${n}×`} selected={freq === n} onPress={() => { setFreq(n); setDays([]) }} />)}</View>
            <Text variant="footnote" color="tertiary">
              Ändert nur das Profil. Den aktiven Plan passt du unter Plan → „Häufigkeit anpassen“ mit Vorschau an.
            </Text>
          </Section>
          <Section title="Dauer">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{[30, 45, 60, 75, 90].map(m => <Chip key={m} label={`${m} min`} selected={dur === m} onPress={() => setDur(m)} />)}</View>
          </Section>
          <Section title="Bevorzugte Tage">
            <View style={{ flexDirection: "row", gap: space[2] }}>{[1, 2, 3, 4, 5, 6, 0].map(d => <Chip key={d} label={WEEKDAYS_SHORT[d]!} size="sm" selected={days.includes(d)} onPress={() => setDays(ds => (ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d]))} />)}</View>
          </Section>
          <Button title="Speichern" fullWidth loading={saving} onPress={() => onSave({ primaryGoal: goals[0]!, secondaryGoals: goals.slice(1), experienceLevel: level, weeklyFrequency: freq, sessionDurationMinutes: dur, preferredWeekdays: days.length === freq ? days : [] })} />
        </Screen>
      </>
    )
  }
}
