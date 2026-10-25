import { useState } from "react"
import { ActionSheetIOS, ActivityIndicator, Alert, RefreshControl, View } from "react-native"
import { useRouter } from "expo-router"
import { MUSCLE_GROUPS } from "@pondus/shared"
import { Button, Card, Chip, EmptyState, ErrorState, ListRow, LoadingState, Screen, Section, Text, useTheme } from "@/design-system"
import { ActiveWorkoutBanner } from "@/components/ActiveWorkoutBanner"
import { useActivePlan, useGeneratePlan, useOverrideSession, usePlans, useActivatePlan, useWeek } from "@/features/plans/queries"
import { useStartWorkout } from "@/features/workout/use-start-workout"
import { SPLIT_LABELS, WEEKDAYS_LONG, WEEKDAYS_SHORT, relativeDay, todayISO } from "@/lib/format"
import { errorMessage } from "@/lib/errors"

export default function PlanScreen() {
  const { space, colors } = useTheme()
  const router = useRouter()
  const plan = useActivePlan()
  const week = useWeek()
  const plans = usePlans()
  const generate = useGeneratePlan()
  const activate = useActivatePlan()
  const override = useOverrideSession()
  const { startEmpty, starting } = useStartWorkout()
  const [refreshing, setRefreshing] = useState(false)
  const [showRationale, setShowRationale] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([plan.refetch(), week.refetch(), plans.refetch()])
    setRefreshing(false)
  }

  const onGenerate = () => {
    Alert.alert("Neuen Plan erstellen?", plan.data ? "Dein aktueller Plan wird archiviert. Deine Trainingshistorie bleibt vollständig erhalten." : "Wir erstellen einen Plan aus deinem Profil.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Erstellen", onPress: () => generate.mutate({ activate: true }, { onError: e => Alert.alert("Fehler", errorMessage(e, "Plan konnte nicht erstellt werden.")) }) },
    ])
  }

  const onSessionOptions = (sessionId: string, name: string, status: string) => {
    if (!week.data) return
    const weekStart = week.data.weekStart
    const today = week.data.today ?? todayISO()
    // Only today and later: moving a session into the past makes no sense.
    const days = [0, 1, 2, 3, 4, 5, 6]
      .map(i => {
        const d = new Date(`${weekStart}T12:00:00`)
        d.setDate(d.getDate() + i)
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        return { iso, label: `${iso === today ? "heute" : WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.` }
      })
      .filter(d => d.iso >= today)
    const actions: { title: string; run: () => void; destructive?: boolean }[] = [
      ...days.map(d => ({ title: `Verschieben auf ${d.label}`, run: () => override.mutate({ sessionId, weekStart, action: "move", date: d.iso }) })),
      { title: status === "skipped" ? "Wieder einplanen" : "Diese Woche auslassen", run: () => override.mutate({ sessionId, weekStart, action: status === "skipped" ? "reset" : "skip" }), destructive: status !== "skipped" },
      { title: "Zurücksetzen", run: () => override.mutate({ sessionId, weekStart, action: "reset" }) },
    ]
    ActionSheetIOS.showActionSheetWithOptions(
      { title: `${name} – nur diese Woche`, options: ["Abbrechen", ...actions.map(a => a.title)], cancelButtonIndex: 0, destructiveButtonIndex: actions.findIndex(a => a.destructive) + 1 || undefined },
      idx => {
        if (idx > 0) actions[idx - 1]?.run()
      },
    )
  }

  if (plan.isLoading && !plan.data) return <LoadingState label="Plan wird geladen" />
  if (plan.isError && !plan.data) return <ErrorState body="Der Plan konnte nicht geladen werden." onRetry={() => void plan.refetch()} />

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}>
      <ActiveWorkoutBanner />
      {!plan.data ? (
        <EmptyState icon="calendar.badge.plus" title="Noch kein Trainingsplan" body="Wir bauen aus deinem Profil einen Plan mit passender Aufteilung, Übungen, Sätzen und Wiederholungen." actionTitle={generate.isPending ? "Wird erstellt…" : "Plan erstellen"} onAction={onGenerate} />
      ) : (
        <>
          <Card tone="muted">
            <Text variant="title2">{plan.data.name}</Text>
            <Text variant="callout" color="secondary" style={{ marginTop: 2 }}>
              {SPLIT_LABELS[plan.data.currentVersion.splitType]} · {plan.data.currentVersion.weeklyFrequency}× pro Woche · Version {plan.data.currentVersion.versionNumber}
            </Text>
            <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3], flexWrap: "wrap" }}>
              <Button title="Häufigkeit anpassen" variant="secondary" size="sm" onPress={() => router.push("/(tabs)/plan/adjust")} />
              <Button title={showRationale ? "Begründung ausblenden" : "Warum so?"} variant="ghost" size="sm" onPress={() => setShowRationale(v => !v)} />
            </View>
          </Card>
          {showRationale ? (
            <Card>
              {plan.data.currentVersion.rationale.map(r => (
                <View key={r.key} style={{ marginBottom: space[3] }}>
                  <Text variant="calloutStrong">{r.title}</Text>
                  <Text variant="callout" color="secondary">
                    {r.body}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          <Section title="Diese Woche" action={week.data ? <Text variant="footnote" color="tertiary">{`${relativeDay(`${week.data.weekStart}T12:00:00`)} – ${relativeDay(`${week.data.weekEnd}T12:00:00`)}`}</Text> : undefined}>
            <Card padding="none">
              {(week.data?.sessions ?? []).map((s, i, arr) => (
                <ListRow
                  key={s.planSessionId}
                  title={s.name}
                  subtitle={`${s.exerciseCount} Übungen · ${s.estimatedDurationMinutes} min · ${s.focusMuscles.slice(0, 3).map(m => MUSCLE_GROUPS.find(g => g.slug === m)?.nameDe ?? m).join(", ")}`}
                  leading={
                    <View style={{ alignItems: "center" }}>
                      <Text variant="caption" color={s.status === "completed" ? "success" : s.status === "skipped" ? "tertiary" : "accent"}>
                        {s.date ? WEEKDAYS_SHORT[new Date(`${s.date}T12:00:00`).getDay()] : "–"}
                      </Text>
                      <Text variant="calloutStrong" color={s.status === "skipped" ? "tertiary" : "primary"}>
                        {s.date ? new Date(`${s.date}T12:00:00`).getDate() : ""}
                      </Text>
                    </View>
                  }
                  trailing={<Chip size="sm" label={s.status === "completed" ? "Erledigt" : s.status === "in_progress" ? "Läuft" : s.status === "skipped" ? "Ausgelassen" : "Geplant"} tone={s.status === "completed" ? "success" : s.status === "in_progress" ? "accent" : "default"} onPress={() => onSessionOptions(s.planSessionId, s.name, s.status)} />}
                  onPress={() => router.push(`/(tabs)/plan/session/${s.planSessionId}`)}
                  last={i === arr.length - 1}
                />
              ))}
            </Card>
            <Text variant="footnote" color="tertiary">
              Tipp: Tippe auf den Status, um eine Einheit nur in dieser Woche zu verschieben oder auszulassen. Die Vorlage bleibt unverändert.
            </Text>
          </Section>

          <Section title="Planstruktur">
            <Card padding="none">
              {plan.data.currentVersion.sessions.map((s, i, arr) => (
                <ListRow key={s.id} title={s.name} subtitle={s.exercises.map(e => e.exerciseName).join(" · ")} value={s.weekday === null ? "flexibel" : WEEKDAYS_SHORT[s.weekday]} onPress={() => router.push(`/(tabs)/plan/session/${s.id}`)} last={i === arr.length - 1} />
              ))}
            </Card>
          </Section>
        </>
      )}

      <Section title="Spontan">
        <Card padding="none">
          <ListRow title="Freies Training starten" subtitle={starting ? "Wird gestartet …" : "Ohne Plan – Übungen während des Workouts hinzufügen"} onPress={starting ? undefined : () => void startEmpty()} chevron={!starting} trailing={starting ? <ActivityIndicator color={colors.accent} /> : undefined} />
          <ListRow title={plan.data ? "Neuen Plan generieren" : "Plan generieren"} subtitle="Aus deinem aktuellen Profil, alter Plan wird archiviert" onPress={onGenerate} last={!plans.data?.some(p => p.status !== "active")} />
          {plans.data
            ?.filter(p => p.status !== "active")
            .map((p, i, arr) => (
              <ListRow key={p.id} title={p.name} subtitle={`${SPLIT_LABELS[p.splitType] ?? p.splitType} · ${p.weeklyFrequency}× · archiviert`} trailing={<Button title="Aktivieren" size="sm" variant="secondary" onPress={() => activate.mutate(p.id)} />} last={i === arr.length - 1} />
            ))}
        </Card>
      </Section>
    </Screen>
  )
}
