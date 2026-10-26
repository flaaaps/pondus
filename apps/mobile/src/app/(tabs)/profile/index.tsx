import { Alert, Share, Switch, View } from "react-native"
import { useRouter } from "expo-router"
import { MUSCLE_GROUPS } from "@pondus/shared"
import { Button, Card, ErrorState, NumberField, ListRow, LoadingState, Screen, Section, SegmentedControl, Text, useTheme } from "@/design-system"
import { useDeleteAccount, useExercisePreferences, useExportData, useProfile, useUpdateUser } from "@/features/profile/queries"
import { useSessionStore, useUser } from "@/services/session-store"
import { useSettingsStore } from "@/services/settings-store"
import { BELL_VOLUMES } from "@/services/rest-alert"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useLiveActivityStatus } from "@/features/live-activity/live-activity"
import { ENVIRONMENT_LABELS, EXPERIENCE_LABELS, GOAL_LABELS, WEEKDAYS_SHORT } from "@/lib/format"

export default function ProfileScreen() {
  const { space, colors } = useTheme()
  const router = useRouter()
  const user = useUser()
  const profile = useProfile()
  const prefs = useExercisePreferences()
  const settings = useSettingsStore()
  const liveActivityUnavailable = useLiveActivityStatus(s => s.unavailable)
  const updateUser = useUpdateUser()
  const signOut = useSessionStore(s => s.signOut)
  const del = useDeleteAccount()
  const exportData = useExportData()
  const pending = useActiveWorkoutStore(s => s.pending)
  const sync = useActiveWorkoutStore(s => s.sync)

  if (profile.isLoading && !profile.data) return <LoadingState />
  if (profile.isError && !profile.data)
    return (
      <Screen>
        <ErrorState body="Dein Profil konnte nicht geladen werden." onRetry={() => void profile.refetch()} />
        <Button title="Abmelden" variant="ghost" onPress={() => void signOut()} style={{ alignSelf: "center" }} />
      </Screen>
    )
  const p = profile.data!

  const onExport = () =>
    exportData.mutate(undefined, {
      onSuccess: data => void Share.share({ title: "Pondus Datenexport", message: JSON.stringify(data, null, 2) }),
      onError: () => Alert.alert("Export fehlgeschlagen", "Bitte später erneut versuchen."),
    })
  const onDelete = () =>
    Alert.alert("Konto löschen?", "Alle deine Daten – Profil, Pläne, Workouts, Bestleistungen – werden endgültig gelöscht.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Endgültig löschen", style: "destructive", onPress: () => del.mutate(undefined, { onError: () => Alert.alert("Löschen fehlgeschlagen", "Bitte später erneut versuchen.") }) },
    ])

  return (
    <Screen>
      <Card>
        <Text variant="title2">{user?.displayName}</Text>
        <Text variant="callout" color="secondary">
          {user?.email}
        </Text>
      </Card>

      <Section title="Trainingsprofil" action={<Text variant="footnote" color="accent" onPress={() => router.push("/(tabs)/profile/edit")}>Bearbeiten</Text>}>
        <Card padding="none">
          <ListRow title="Ziel" value={[p.primaryGoal, ...p.secondaryGoals].map(g => GOAL_LABELS[g]).join(", ")} onPress={() => router.push("/(tabs)/profile/edit")} />
          <ListRow title="Erfahrung" value={EXPERIENCE_LABELS[p.experienceLevel]} onPress={() => router.push("/(tabs)/profile/edit")} />
          <ListRow title="Häufigkeit" value={`${p.weeklyFrequency}× pro Woche`} subtitle={p.preferredWeekdays.length ? p.preferredWeekdays.map(d => WEEKDAYS_SHORT[d]).join(", ") : undefined} onPress={() => router.push("/(tabs)/plan/adjust")} />
          <ListRow title="Dauer" value={`${p.sessionDurationMinutes} min`} onPress={() => router.push("/(tabs)/plan/adjust")} />
          <ListRow title="Umgebung" value={ENVIRONMENT_LABELS[p.environment]} onPress={() => router.push("/(tabs)/profile/equipment")} />
          <ListRow title="Fokusmuskeln" value={p.musclePriorities.length ? p.musclePriorities.map(m => MUSCLE_GROUPS.find(g => g.slug === m.muscle)?.nameDe ?? m.muscle).join(", ") : "Keine"} onPress={() => router.push("/(tabs)/profile/focus")} />
          <ListRow title="Übungspräferenzen" value={prefs.data ? `${prefs.data.preferred.length} ♥ · ${prefs.data.excluded.length} ✕` : "…"} onPress={() => router.push("/(tabs)/profile/preferences")} last />
        </Card>
        <Text variant="footnote" color="tertiary">
          Änderungen am Profil wirken sich auf neue Pläne und Plananpassungen aus. Deine Trainingshistorie bleibt immer erhalten.
        </Text>
      </Section>

      <Section title="Darstellung">
        <Card>
          <Text variant="calloutStrong" color="secondary" style={{ marginBottom: space[2] }}>
            THEME
          </Text>
          <SegmentedControl options={[{ value: "system", label: "System" }, { value: "light", label: "Hell" }, { value: "dark", label: "Dunkel" }]} value={settings.appearance} onChange={settings.setAppearance} />
          <View style={{ height: space[3] }} />
          <Text variant="calloutStrong" color="secondary" style={{ marginBottom: space[2] }}>
            GEWICHTSEINHEIT
          </Text>
          <SegmentedControl
            options={[{ value: "kg", label: "Kilogramm" }, { value: "lb", label: "Pfund" }]}
            value={settings.weightUnit}
            onChange={u => {
              settings.setWeightUnit(u)
              updateUser.mutate({ weightUnit: u })
            }}
          />
        </Card>
      </Section>

      <Section title="Pausentimer">
        <Card padding="none">
          <ListRow title="Benachrichtigung bei Ablauf" trailing={<Switch accessibilityLabel="Benachrichtigung bei Ablauf" value={settings.restTimerNotifications} onValueChange={settings.setRestTimerNotifications} trackColor={{ true: colors.accent }} />} />
          <ListRow title="Haptisches Feedback" trailing={<Switch accessibilityLabel="Haptisches Feedback" value={settings.restTimerHaptics} onValueChange={settings.setRestTimerHaptics} trackColor={{ true: colors.accent }} />} />
          <ListRow
            title="Glocke am Pausenende"
            subtitle="Mit Kopfhörern statt der Benachrichtigung, auch bei gesperrtem iPhone"
            trailing={<Switch accessibilityLabel="Glocke am Pausenende, bei Kopfhörern" value={settings.restBell} onValueChange={settings.setRestBell} trackColor={{ true: colors.accent }} />}
          />
          {settings.restBell ? (
            <>
              <ListRow
                title="Lautstärke"
                trailing={
                  <View style={{ width: 210 }}>
                    <SegmentedControl options={[...BELL_VOLUMES]} value={nearestBellVolume(settings.restBellVolume)} onChange={v => settings.setRestBellVolume(Number(v))} />
                  </View>
                }
              />
              <ListRow
                title="Musik leiser bei der Glocke"
                subtitle="Spotify, Podcasts & Co. werden kurz gedämpft"
                trailing={<Switch accessibilityLabel="Musik leiser bei der Glocke" value={settings.restBellDuck} onValueChange={settings.setRestBellDuck} trackColor={{ true: colors.accent }} />}
              />
            </>
          ) : null}
          <ListRow
            title="Standardpause"
            subtitle="Für freies Training und neue Übungen"
            trailing={
              <View style={{ width: 150 }}>
                <NumberField value={settings.defaultRestSeconds} onChange={v => settings.setDefaultRestSeconds(v ?? 120)} step={15} min={30} max={300} suffix="s" compact accessibilityLabel="Standardpause in Sekunden" />
              </View>
            }
            last
          />
        </Card>
      </Section>

      <Section title="Aktives Workout">
        <Card padding="none">
          <ListRow
            title="Live Activity auf dem Sperrbildschirm"
            subtitle={liveActivityUnavailable ? "In den iOS-Einstellungen ausgeschaltet: Einstellungen → Pondus → Live-Aktivitäten" : "Übung, Satz und Pause auch in der Dynamic Island"}
            trailing={<Switch accessibilityLabel="Live Activity auf dem Sperrbildschirm" value={settings.liveActivityEnabled} onValueChange={settings.setLiveActivityEnabled} trackColor={{ true: colors.accent }} />}
            last
          />
        </Card>
      </Section>

      <Section title="Account & Daten">
        <Card padding="none">
          <ListRow title="Synchronisierung" value={pending ? `${pending} ausstehend` : "Aktuell"} subtitle={sync === "offline" ? "Offline – wird nachgeholt, sobald Verbindung besteht" : sync === "error" ? "Letzter Versuch fehlgeschlagen" : undefined} />
          <ListRow title="Daten exportieren (JSON)" subtitle="Alle Pläne, Workouts und Bestleistungen" onPress={onExport} />
          <ListRow title="Datenschutz" subtitle="Was wir speichern und warum" onPress={() => router.push("/(tabs)/profile/privacy")} />
          <ListRow title="Abmelden" onPress={() => void signOut()} />
          <ListRow title="Konto löschen" destructive onPress={onDelete} last />
        </Card>
      </Section>
      <Text variant="footnote" color="tertiary" align="center">
        Pondus 0.1.0
      </Text>
    </Screen>
  )
}

/** The stored volume as one of the offered steps. */
function nearestBellVolume(v: number): (typeof BELL_VOLUMES)[number]["value"] {
  return BELL_VOLUMES.reduce((best, o) => (Math.abs(Number(o.value) - v) < Math.abs(Number(best.value) - v) ? o : best)).value
}
