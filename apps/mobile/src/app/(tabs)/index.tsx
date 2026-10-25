import { useState } from "react"
import { RefreshControl, View } from "react-native"
import { useRouter } from "expo-router"
import { MUSCLE_GROUPS } from "@pondus/shared"
import { Button, Card, EmptyState, ErrorState, Screen, Section, Skeleton, Stat, Text, useTheme } from "@/design-system"
import { ActiveWorkoutBanner } from "@/components/ActiveWorkoutBanner"
import { useWeek, useSession } from "@/features/plans/queries"
import { useOverview } from "@/features/progress/queries"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useStartWorkout } from "@/features/workout/use-start-workout"
import { useUser } from "@/services/session-store"
import { useSettingsStore } from "@/services/settings-store"
import { formatDuration, formatTonnage, relativeDay, RECORD_TYPE_LABELS, formatWeight, WEEKDAYS_SHORT } from "@/lib/format"

export default function HomeScreen() {
  const { space, colors } = useTheme()
  const router = useRouter()
  const user = useUser()
  const unit = useSettingsStore(s => s.weightUnit)
  const week = useWeek()
  const overview = useOverview("4w")
  const active = useActiveWorkoutStore(s => s.workout)
  const next = week.data?.sessions.find(s => s.planSessionId === week.data?.nextSessionId) ?? null
  const session = useSession(next?.planSessionId)
  const { start, starting } = useStartWorkout()
  const [refreshing, setRefreshing] = useState(false)
  const refresh = async () => {
    setRefreshing(true)
    await Promise.all([week.refetch(), overview.refetch()])
    setRefreshing(false)
  }
  const hour = new Date().getHours()
  const greeting = hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend"
  const doneThisWeek = week.data?.sessions.filter(s => s.status === "completed").length ?? 0

  return (
    <Screen title={`${greeting}, ${user?.displayName ?? ""}`} subtitle={week.data ? `${doneThisWeek} von ${week.data.sessions.length} Einheiten diese Woche` : undefined} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}>
      <ActiveWorkoutBanner />

      {!active ? (
        <Section title="Nächstes Training">
          {week.isLoading && !week.data ? (
            <Card>
              <Skeleton height={24} width="60%" />
              <View style={{ height: space[2] }} />
              <Skeleton height={16} width="40%" />
            </Card>
          ) : week.isError && !week.data ? (
            <ErrorState body="Der Plan konnte nicht geladen werden." onRetry={() => void week.refetch()} />
          ) : !week.data?.planId ? (
            <EmptyState icon="calendar.badge.plus" title="Noch kein Trainingsplan" body="Erstelle in einer Minute einen Plan, der zu deinem Profil passt." actionTitle="Plan erstellen" onAction={() => router.push("/(tabs)/plan")} />
          ) : next ? (
            <Card tone="strong" padding="lg">
              <Text variant="caption" color="inverse" style={{ opacity: 0.7 }}>
                {next.date ? relativeDay(`${next.date}T12:00:00`).toUpperCase() : "FLEXIBEL"} · {next.estimatedDurationMinutes} MIN
              </Text>
              <Text variant="title1" color="inverse" style={{ marginTop: space[1] }}>
                {next.name}
              </Text>
              <Text variant="callout" color="inverse" style={{ opacity: 0.75, marginTop: space[1] }}>
                {next.exerciseCount} Übungen · {next.focusMuscles.slice(0, 3).map(m => MUSCLE_GROUPS.find(g => g.slug === m)?.nameDe ?? m).join(", ")}
              </Text>
              <View style={{ flexDirection: "row", gap: space[2], marginTop: space[4] }}>
                <Button title="Workout starten" loading={starting} disabled={!session.data} onPress={() => session.data && void start(session.data.session)} hapticStyle="medium" />
                <Button title="Details" variant="glass" onPress={() => router.push(`/(tabs)/plan/session/${next.planSessionId}`)} />
              </View>
            </Card>
          ) : (
            <EmptyState icon="checkmark.seal" title="Woche geschafft" body="Alle geplanten Einheiten sind erledigt. Spontan noch etwas? Starte ein freies Training." actionTitle="Freies Training" onAction={() => router.push("/(tabs)/plan")} />
          )}
        </Section>
      ) : null}

      {week.data?.sessions.length ? (
        <Section title="Diese Woche">
          <Card padding="sm">
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {[1, 2, 3, 4, 5, 6, 0].map(day => {
                const date = week.data!.weekStart && new Date(`${week.data!.weekStart}T12:00:00`)
                const d = new Date(date)
                d.setDate(d.getDate() + ((day + 6) % 7))
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                const s = week.data!.sessions.find(x => x.date === iso)
                const isToday = iso === new Date().toISOString().slice(0, 10)
                const bg = s?.status === "completed" ? colors.success : s?.status === "in_progress" ? colors.accent : s ? colors.surfaceMuted : "transparent"
                return (
                  <View key={day} style={{ alignItems: "center", gap: 6, flex: 1 }}>
                    <Text variant="caption" color={isToday ? "accent" : "tertiary"}>
                      {WEEKDAYS_SHORT[day]}
                    </Text>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: bg, alignItems: "center", justifyContent: "center", borderWidth: isToday ? 2 : 0, borderColor: colors.accent }}>
                      {s ? (
                        <Text variant="caption" style={{ color: s.status === "completed" || s.status === "in_progress" ? colors.textOnAccent : colors.textSecondary }}>
                          {s.name.slice(0, 1)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )
              })}
            </View>
          </Card>
        </Section>
      ) : null}

      {overview.data ? (
        <>
          <Section title="Letzte 4 Wochen">
            <Card>
              <View style={{ flexDirection: "row", gap: space[3] }}>
                <Stat label="Workouts" value={String(overview.data.workoutsLast4Weeks)} />
                <Stat label="Serie" value={String(overview.data.currentStreakWeeks)} unit={overview.data.currentStreakWeeks === 1 ? "Woche" : "Wochen"} />
                <Stat label="Gesamt" value={String(overview.data.totalWorkouts)} />
              </View>
            </Card>
          </Section>
          {overview.data.lastWorkout ? (
            <Section title="Letztes Workout">
              <Card onPress={() => router.push(`/(tabs)/progress/workout/${overview.data!.lastWorkout!.id}`)}>
                <Text variant="bodyStrong">{overview.data.lastWorkout.name}</Text>
                <Text variant="footnote" color="secondary">
                  {relativeDay(overview.data.lastWorkout.completedAt)} · {formatDuration(overview.data.lastWorkout.durationSeconds)} · {overview.data.lastWorkout.workingSets} Sätze · {formatTonnage(overview.data.lastWorkout.tonnageGrams, unit)}
                </Text>
              </Card>
            </Section>
          ) : null}
          {overview.data.recentRecords.length ? (
            <Section title="Bestleistungen" action={<Button title="Alle" variant="ghost" size="sm" onPress={() => router.push("/(tabs)/progress/records")} />}>
              <Card padding="none">
                {overview.data.recentRecords.slice(0, 3).map((r, i, arr) => (
                  <View key={`${r.exerciseName}-${r.type}-${r.achievedAt}`} style={{ padding: space[3], paddingHorizontal: space[4], borderBottomWidth: i === arr.length - 1 ? 0 : 0.5, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: space[3] }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="body">{r.exerciseName}</Text>
                      <Text variant="footnote" color="secondary">
                        {RECORD_TYPE_LABELS[r.type]}
                        {r.isEstimate ? " (Schätzung)" : ""} · {relativeDay(r.achievedAt)}
                      </Text>
                    </View>
                    <Text variant="numeral" color="accent">
                      {r.type === "max_reps_at_weight" ? `${r.reps} × ${formatWeight(r.weightGrams, unit)}` : formatWeight(r.valueGrams ?? r.weightGrams, unit)}
                    </Text>
                  </View>
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  )
}
