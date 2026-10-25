import { useMemo, useState } from "react"
import { ActionSheetIOS, Alert, Pressable, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { SafeAreaView } from "react-native-safe-area-context"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import type { PlanDto, PlanEditOp, PlanExerciseDto } from "@pondus/shared"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-client"
import { MUSCLE_GROUPS } from "@pondus/shared"
import { Button, Card, ErrorState, ListRow, LoadingState, NumberField, Screen, Section, Text, useTheme } from "@/design-system"
import { useEditPlan, useSession } from "@/features/plans/queries"
import { useStartWorkout } from "@/features/workout/use-start-workout"
import { useExercisePicker } from "@/features/exercises/picker-store"
import { useAllExercises } from "@/features/exercises/queries"
import { ExerciseThumbnail } from "@/components/ExerciseMedia"
import { WEEKDAYS_LONG } from "@/lib/format"
import { errorMessage } from "@/lib/errors"

/**
 * One training session of the plan template. Every change here creates a new
 * plan version on the server; completed workouts keep their old version.
 */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { space, colors } = useTheme()
  const router = useRouter()
  const q = useSession(id)
  const edit = useEditPlan(q.data?.planId)
  const { start, starting } = useStartWorkout()
  const picker = useExercisePicker()
  const library = useAllExercises()
  const slugById = useMemo(() => new Map((library.data ?? []).filter(e => e.isSystem).map(e => [e.id, e.slug])), [library.data])
  const [editing, setEditing] = useState<string | null>(null)

  const qc = useQueryClient()
  /**
   * Every edit creates a new plan version with new session ids. Pick the
   * matching session from the response (same sessionKey, else same sequence) and switch the route
   * to it, so the screen shows the change immediately.
   */
  const onEdited = (plan: PlanDto) => {
    const current = q.data?.session
    const sessions = plan.currentVersion.sessions
    // sessionKey is stable across versions; sequence/name are the fallback for servers without it.
    const next = (current?.sessionKey ? sessions.find(s => s.sessionKey === current.sessionKey) : undefined) ?? sessions.find(s => s.sequence === current?.sequence) ?? sessions.find(s => s.name === current?.name)
    if (!next) return void q.refetch()
    qc.setQueryData(queryKeys.session(next.id), { planId: plan.id, planName: plan.name, versionNumber: plan.currentVersion.versionNumber, session: next })
    if (next.id !== id) router.setParams({ id: next.id })
  }
  const apply = (ops: PlanEditOp[]) => edit.mutate(ops, { onSuccess: onEdited, onError: e => Alert.alert("Änderung fehlgeschlagen", errorMessage(e, "Unbekannter Fehler")) })

  if (q.isLoading) return <LoadingState />
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />
  const { session } = q.data

  const onMove = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: "Fester Wochentag für diese Einheit", options: ["Abbrechen", ...[1, 2, 3, 4, 5, 6, 0].map(d => WEEKDAYS_LONG[d]!), "Flexibel (kein fester Tag)"], cancelButtonIndex: 0 },
      idx => {
        if (idx === 0) return
        apply([{ op: "move_session", sessionId: session.id, weekday: idx === 8 ? null : [1, 2, 3, 4, 5, 6, 0][idx - 1]! }])
      },
    )
  }

  const onExerciseOptions = (e: PlanExerciseDto, index: number) => {
    const options = ["Abbrechen", "Austauschen", "Sätze & Wiederholungen", index > 0 ? "Nach oben" : null, index < session.exercises.length - 1 ? "Nach unten" : null, "Duplizieren", "Entfernen"].filter((x): x is string => !!x)
    ActionSheetIOS.showActionSheetWithOptions({ title: e.exerciseName, options, cancelButtonIndex: 0, destructiveButtonIndex: options.length - 1 }, idx => {
      const choice = options[idx]
      if (!choice || choice === "Abbrechen") return
      if (choice === "Austauschen") {
        picker.open({ title: `${e.exerciseName} ersetzen`, alternativesFor: e.exerciseId, onPick: ex => apply([{ op: "swap_exercise", planExerciseId: e.id, newExerciseId: ex.id }]) })
        router.push("/workout/pick-exercise")
      } else if (choice === "Sätze & Wiederholungen") setEditing(editing === e.id ? null : e.id)
      else if (choice === "Nach oben" || choice === "Nach unten") {
        const ids = session.exercises.map(x => x.id)
        const j = choice === "Nach oben" ? index - 1 : index + 1
        ;[ids[index], ids[j]] = [ids[j]!, ids[index]!]
        apply([{ op: "reorder_exercises", sessionId: session.id, planExerciseIds: ids }])
      } else if (choice === "Duplizieren") apply([{ op: "duplicate_exercise", planExerciseId: e.id }])
      else if (choice === "Entfernen") Alert.alert("Übung entfernen?", `${e.exerciseName} wird aus dieser Einheit entfernt.`, [{ text: "Abbrechen", style: "cancel" }, { text: "Entfernen", style: "destructive", onPress: () => apply([{ op: "remove_exercise", planExerciseId: e.id }]) }])
    })
  }

  const totalSets = session.exercises.reduce((a, e) => a + e.targetSets, 0)

  return (
    <>
      <Stack.Screen options={{ title: session.name, headerLargeTitle: false }} />
      <Screen bottomInset={88}>
        <Card tone="muted">
          <Text variant="callout" color="secondary">
            {session.weekday === null ? "Kein fester Tag" : WEEKDAYS_LONG[session.weekday]} · ca. {session.estimatedDurationMinutes} min · {session.exercises.length} Übungen · {totalSets} Arbeitssätze
          </Text>
          <Text variant="footnote" color="tertiary" style={{ marginTop: 2 }}>
            {session.focusMuscles.map(m => MUSCLE_GROUPS.find(g => g.slug === m)?.nameDe ?? m).join(", ")}
          </Text>
          <View style={{ flexDirection: "row", gap: space[2], marginTop: space[3] }}>
            <Button title="Wochentag" variant="secondary" size="sm" onPress={onMove} />
            <Button title="Übung hinzufügen" variant="secondary" size="sm" onPress={() => {
              picker.open({ title: "Übung hinzufügen", onPick: ex => apply([{ op: "add_exercise", sessionId: session.id, exerciseId: ex.id }]) })
              router.push("/workout/pick-exercise")
            }} />
          </View>
        </Card>

        <Section title="Übungen">
          <Card padding="none">
            {session.exercises.map((e, i, arr) => (
              <View key={e.id}>
                <ListRow
                  title={e.exerciseName}
                  subtitle={`${e.warmupSets ? `${e.warmupSets} Aufwärm- + ` : ""}${e.targetSets} × ${e.targetRepsMin}–${e.targetRepsMax} Wdh. · ${Math.round(e.restSeconds / 60 * 10) / 10} min Pause${e.targetRir !== null ? ` · RIR ${e.targetRir}` : ""}`}
                  leading={<ExerciseThumbnail slug={slugById.get(e.exerciseId)} size={60} />}
                  onPress={() => router.push(`/(tabs)/plan/exercise/${e.exerciseId}`)}
                  accessibilityActions={[{ name: "options", label: "Optionen" }]}
                  onAccessibilityAction={ev => ev.nativeEvent.actionName === "options" && onExerciseOptions(e, i)}
                  chevron={false}
                  trailing={
                    <Pressable accessibilityRole="button" accessibilityLabel={`Optionen für ${e.exerciseName}`} hitSlop={10} onPress={() => onExerciseOptions(e, i)} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}>
                      <SymbolView name="ellipsis.circle" size={22} tintColor={colors.accent} />
                    </Pressable>
                  }
                  last={i === arr.length - 1 && editing !== e.id}
                />
                {editing === e.id ? <ExerciseParamsEditor exercise={e} onSave={params => { apply([{ op: "update_exercise", planExerciseId: e.id, params }]); setEditing(null) }} onCancel={() => setEditing(null)} /> : null}
              </View>
            ))}
          </Card>
          <Text variant="footnote" color="tertiary">
            Jede Änderung erzeugt eine neue Planversion. Bereits absolvierte Workouts bleiben unverändert.
          </Text>
        </Section>
        {edit.isPending ? <LoadingState label="Wird gespeichert" /> : null}
      </Screen>
      {/* Native SafeAreaView: its bottom inset includes the floating tab bar, so the button never sits underneath it. */}
      <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
          <Button title="Dieses Training starten" fullWidth loading={starting} onPress={() => void start(session)} hapticStyle="medium" />
        </View>
      </SafeAreaView>
    </>
  )
}

function ExerciseParamsEditor({ exercise, onSave, onCancel }: { exercise: PlanExerciseDto; onSave: (p: { targetSets: number; targetRepsMin: number; targetRepsMax: number; restSeconds: number; targetRir: number | null; warmupSets: number }) => void; onCancel: () => void }) {
  const { space, colors } = useTheme()
  const [sets, setSets] = useState(exercise.targetSets)
  const [min, setMin] = useState(exercise.targetRepsMin)
  const [max, setMax] = useState(exercise.targetRepsMax)
  const [rest, setRest] = useState(exercise.restSeconds)
  const [rir, setRir] = useState<number | null>(exercise.targetRir)
  const [warm, setWarm] = useState(exercise.warmupSets)
  return (
    <View style={{ padding: space[4], gap: space[3], backgroundColor: colors.surfaceMuted }}>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ flex: 1 }}><NumberField label="Sätze" value={sets} onChange={v => setSets(v ?? 1)} step={1} min={1} max={12} compact /></View>
        <View style={{ flex: 1 }}><NumberField label="Aufwärmen" value={warm} onChange={v => setWarm(v ?? 0)} step={1} min={0} max={5} compact /></View>
      </View>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ flex: 1 }}><NumberField label="Wdh. min" value={min} onChange={v => { const n = v ?? 1; setMin(n); if (n > max) setMax(n) }} step={1} min={1} max={100} compact /></View>
        <View style={{ flex: 1 }}><NumberField label="Wdh. max" value={max} onChange={v => { const n = v ?? 1; setMax(n); if (n < min) setMin(n) }} step={1} min={1} max={100} compact /></View>
      </View>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ flex: 1 }}><NumberField label="Pause (s)" value={rest} onChange={v => setRest(v ?? 0)} step={15} min={0} max={900} compact /></View>
        <View style={{ flex: 1 }}><NumberField label="RIR" value={rir} onChange={setRir} step={1} min={0} max={10} compact placeholder="–" /></View>
      </View>
      <View style={{ flexDirection: "row", gap: space[2], justifyContent: "flex-end" }}>
        <Button title="Abbrechen" variant="ghost" size="sm" onPress={onCancel} />
        <Button title="Speichern" size="sm" onPress={() => onSave({ targetSets: sets, targetRepsMin: min, targetRepsMax: max, restSeconds: rest, targetRir: rir, warmupSets: warm })} />
      </View>
    </View>
  )
}
