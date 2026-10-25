import { useState } from "react"
import { Alert, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import type { AdjustmentPreviewDto } from "@pondus/shared"
import { Button, Card, Chip, ErrorState, ListRow, LoadingState, Screen, Section, Text, useTheme } from "@/design-system"
import { useActivePlan, useApplyAdjustment, useDiscardAdjustment, usePreviewAdjustment } from "@/features/plans/queries"
import { useProfile } from "@/features/profile/queries"
import { SPLIT_LABELS } from "@/lib/format"
import { ApiError } from "@/lib/api-client"

/** Change frequency / duration → preview the restructured plan → accept or discard. */
export default function AdjustScreen() {
  const { space } = useTheme()
  const router = useRouter()
  const plan = useActivePlan()
  const profile = useProfile()
  const preview = usePreviewAdjustment(plan.data?.id)
  const apply = useApplyAdjustment(plan.data?.id)
  const discard = useDiscardAdjustment(plan.data?.id)
  const [frequency, setFrequency] = useState<number | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [split, setSplit] = useState<string | null>(null)
  const [result, setResult] = useState<AdjustmentPreviewDto | null>(null)

  if (plan.isLoading || profile.isLoading) return <LoadingState />
  if (!plan.data || !profile.data) return <ErrorState body="Kein aktiver Plan." onRetry={() => void plan.refetch()} />
  const curFreq = frequency ?? plan.data.currentVersion.weeklyFrequency
  const curDur = duration ?? profile.data.sessionDurationMinutes
  const changed = curFreq !== plan.data.currentVersion.weeklyFrequency || curDur !== profile.data.sessionDurationMinutes || (split !== null && split !== plan.data.currentVersion.splitType)

  const onPreview = () => {
    if (result) void discard.mutateAsync(result.previewId).catch(() => {})
    preview.mutate({ weeklyFrequency: curFreq, sessionDurationMinutes: curDur, splitType: split ?? undefined }, { onSuccess: setResult, onError: e => Alert.alert("Vorschau fehlgeschlagen", e instanceof ApiError ? e.message : "Unbekannter Fehler") })
  }
  const onApply = () => {
    if (!result) return
    apply.mutate(result.previewId, {
      onSuccess: () => router.back(),
      onError: e => Alert.alert("Übernehmen fehlgeschlagen", e instanceof ApiError ? e.message : "Unbekannter Fehler"),
    })
  }
  const onDiscard = () => {
    if (result) void discard.mutateAsync(result.previewId).catch(() => {})
    setResult(null)
  }

  return (
    <>
      <Stack.Screen options={{ title: "Plan anpassen", headerLargeTitle: false }} />
      <Screen>
        <Section title="Trainingshäufigkeit">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {[2, 3, 4, 5, 6].map(n => (
              <Chip key={n} label={`${n}×`} selected={curFreq === n} onPress={() => { setFrequency(n); setResult(null) }} />
            ))}
          </View>
        </Section>
        <Section title="Dauer pro Einheit">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {[30, 45, 60, 75, 90].map(m => (
              <Chip key={m} label={`${m} min`} selected={curDur === m} onPress={() => { setDuration(m); setResult(null) }} />
            ))}
          </View>
        </Section>
        <Section title="Aufteilung">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            <Chip label="Automatisch" selected={split === null} onPress={() => { setSplit(null); setResult(null) }} />
            {(["full_body", "upper_lower", "push_pull_legs"] as const).map(s => (
              <Chip key={s} label={SPLIT_LABELS[s]!} selected={split === s} onPress={() => { setSplit(s); setResult(null) }} />
            ))}
          </View>
        </Section>
        <Button title="Vorschau berechnen" fullWidth disabled={!changed} loading={preview.isPending} onPress={onPreview} />

        {result ? (
          <>
            <Section title="Was sich ändert">
              <Card>
                {result.diff.summary.map((line, i) => (
                  <Text key={i} variant="callout" style={{ marginBottom: 4 }}>
                    • {line}
                  </Text>
                ))}
              </Card>
              {result.diff.exercisesAdded.length ? (
                <Card padding="none">
                  <ListRow title="Neue Übungen" subtitle={result.diff.exercisesAdded.map(e => `${e.name} (${e.sessionName})`).join(", ")} last />
                </Card>
              ) : null}
              {result.diff.exercisesRemoved.length ? (
                <Card padding="none">
                  <ListRow title="Entfallende Übungen" subtitle={result.diff.exercisesRemoved.map(e => `${e.name} (${e.sessionName})`).join(", ")} last />
                </Card>
              ) : null}
              {result.diff.weeklySetsDelta.length ? (
                <Card padding="none">
                  {result.diff.weeklySetsDelta.map((d, i, arr) => (
                    <ListRow key={d.muscle} title={d.label} value={`${d.before} → ${d.after} Sätze`} last={i === arr.length - 1} />
                  ))}
                </Card>
              ) : null}
            </Section>
            <Section title="Neue Struktur">
              <Card padding="none">
                {result.proposal.sessions.map((s, i, arr) => (
                  <ListRow key={s.sequence} title={s.name} subtitle={s.exercises.map(e => e.exerciseName).join(" · ")} value={`${s.estimatedDurationMinutes} min`} last={i === arr.length - 1} />
                ))}
              </Card>
            </Section>
            <View style={{ flexDirection: "row", gap: space[2] }}>
              <Button title="Verwerfen" variant="secondary" onPress={onDiscard} style={{ flex: 1 }} />
              <Button title="Übernehmen" loading={apply.isPending} onPress={onApply} style={{ flex: 1 }} hapticStyle="medium" />
            </View>
            <Text variant="footnote" color="tertiary">
              Beim Übernehmen entsteht eine neue Planversion und dein Profil wird aktualisiert. Abgeschlossene Workouts bleiben unverändert.
            </Text>
          </>
        ) : null}
      </Screen>
    </>
  )
}
