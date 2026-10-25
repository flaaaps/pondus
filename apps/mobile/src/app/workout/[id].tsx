import { useCallback, useMemo, useState } from "react"
import { ActionSheetIOS, Alert, ScrollView, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"
import { useKeepAwake } from "expo-keep-awake"
import type { WorkoutExerciseDto, WorkoutSetDto } from "@pondus/shared"
import { DEFAULT_INCREMENT_GRAMS } from "@pondus/shared"
import { Button, Card, Chip, EmptyState, Text, useTheme } from "@/design-system"
import { RestTimerBar } from "@/components/RestTimerBar"
import { SetRow } from "@/components/SetRow"
import { ExerciseAnimation, ExerciseThumbnail } from "@/components/ExerciseMedia"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useElapsed } from "@/features/workout/use-elapsed"
import { useExercisePicker } from "@/features/exercises/picker-store"
import { useAllExercises } from "@/features/exercises/queries"
import { useApi } from "@/services/session-store"
import { useRestTimerStore } from "@/services/rest-timer-store"
import { useSettingsStore } from "@/services/settings-store"
import { formatTimer, formatTonnage } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { tonnageGrams } from "@pondus/shared"

/**
 * The active workout. Local-first: every tap updates SQLite immediately and
 * is queued for the server. Keeps the screen awake, keyboard never covers
 * the active row (KeyboardAwareScrollView), rest timer floats above.
 */
export default function ActiveWorkoutScreen() {
  useKeepAwake()
  const { colors, space } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const api = useApi()
  const store = useActiveWorkoutStore()
  const workout = store.workout
  const elapsed = useElapsed(workout)
  const unit = useSettingsStore(s => s.weightUnit)
  const defaultRest = useSettingsStore(s => s.defaultRestSeconds)
  const timer = useRestTimerStore()
  const picker = useExercisePicker()
  const library = useAllExercises()
  const [focusIndex, setFocusIndex] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const libraryById = useMemo(() => new Map((library.data ?? []).map(e => [e.id, e])), [library.data])

  const slugFor = useCallback((ex: WorkoutExerciseDto) => (ex.exerciseId ? libraryById.get(ex.exerciseId)?.slug : undefined), [libraryById])
  const stepFor = useCallback(
    (ex: WorkoutExerciseDto) => {
      const ref = ex.exerciseId ? libraryById.get(ex.exerciseId) : undefined
      if (!ref) return 2500
      const steps = ref.equipment.map(e => DEFAULT_INCREMENT_GRAMS[e] ?? 2500).filter(v => v > 0)
      return steps.length ? Math.min(...steps) : 2500
    },
    [libraryById],
  )

  if (!workout) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <EmptyState icon="figure.strengthtraining.traditional" title="Kein aktives Workout" actionTitle="Zurück" onAction={() => router.back()} />
      </View>
    )
  }
  const visible = workout.exercises.filter(e => !e.skipped)
  const allSets = visible.flatMap(e => e.sets)
  const doneSets = allSets.filter(s => s.completed && s.setType !== "warmup").length
  const tonnage = tonnageGrams(allSets.map(s => ({ setType: s.setType, weightGrams: s.weightGrams, reps: s.reps, completed: s.completed })))

  const completeSet = (ex: WorkoutExerciseDto, set: WorkoutSetDto) => {
    const completed = !set.completed
    haptic(completed ? "success" : "light")
    store.upsertSet(api, ex, { clientId: set.clientId ?? set.id, setNumber: set.setNumber, completed, completedAt: completed ? new Date().toISOString() : null })
    if (completed && set.setType !== "warmup") timer.start(ex.restSeconds ?? defaultRest, ex.exerciseNameSnapshot)
  }
  const changeSet = (ex: WorkoutExerciseDto, set: WorkoutSetDto, patch: Partial<WorkoutSetDto>) => {
    // Edits to not-yet-completed sets stay local until completion; completed sets sync immediately.
    if (!set.completed) {
      const w = useActiveWorkoutStore.getState().workout
      if (!w) return
      useActiveWorkoutStore.setState({ workout: { ...w, exercises: w.exercises.map(e => (e.id !== ex.id ? e : { ...e, sets: e.sets.map(s => (s.id === set.id ? { ...s, ...patch } : s)) })) } })
      return
    }
    store.upsertSet(api, ex, { ...patch, clientId: set.clientId ?? set.id, setNumber: set.setNumber })
  }
  const setOptions = (ex: WorkoutExerciseDto, set: WorkoutSetDto) =>
    ActionSheetIOS.showActionSheetWithOptions({ title: `Satz ${set.setNumber}`, options: ["Abbrechen", "RIR setzen (0–4)", "Satz löschen"], cancelButtonIndex: 0, destructiveButtonIndex: 2 }, idx => {
      if (idx === 2) store.deleteSet(api, set)
      if (idx === 1) ActionSheetIOS.showActionSheetWithOptions({ title: "Wiederholungen in Reserve", options: ["Abbrechen", "0 – am Limit", "1", "2", "3", "4+"], cancelButtonIndex: 0 }, r => r > 0 && changeSet(ex, set, { rir: r - 1 }))
    })
  const exerciseOptions = (ex: WorkoutExerciseDto) =>
    ActionSheetIOS.showActionSheetWithOptions({ title: ex.exerciseNameSnapshot, options: ["Abbrechen", "Übung austauschen (nur heute)", "Pause für diese Übung ändern", "Übung überspringen"], cancelButtonIndex: 0, destructiveButtonIndex: 3 }, idx => {
      if (idx === 1) {
        picker.open({ title: `${ex.exerciseNameSnapshot} ersetzen`, alternativesFor: ex.exerciseId ?? undefined, onPick: e => store.addExercise(api, e, { replaces: ex }) })
        router.push("/workout/pick-exercise")
      } else if (idx === 2) {
        ActionSheetIOS.showActionSheetWithOptions({ title: "Pausendauer", options: ["Abbrechen", "60 s", "90 s", "120 s", "150 s", "180 s", "240 s"], cancelButtonIndex: 0 }, r => r > 0 && store.dispatch(api, { kind: "update_exercise", workoutClientId: workout.clientId ?? workout.id, exerciseClientId: ex.clientId ?? ex.id, body: { restSeconds: [60, 90, 120, 150, 180, 240][r - 1]! } }))
      } else if (idx === 3) store.skipExercise(api, ex, true)
    })

  const finish = () => {
    const open = visible.filter(e => !e.sets.some(s => s.completed)).length
    Alert.alert("Workout beenden?", `${doneSets} Arbeitssätze protokolliert${open ? `, ${open} Übung(en) ohne Satz` : ""}.`, [
      { text: "Weiter trainieren", style: "cancel" },
      {
        text: "Beenden",
        onPress: async () => {
          setFinishing(true)
          timer.stop()
          try {
            const { workout: done, serverId } = await store.complete(api)
            haptic("success")
            router.replace({ pathname: "/workout/summary", params: { id: serverId ?? "", local: serverId ? "" : "1", clientId: done.clientId ?? "" } })
          } finally {
            setFinishing(false)
          }
        },
      },
    ])
  }
  const cancel = () =>
    Alert.alert("Workout abbrechen?", "Alle Eingaben dieser Einheit werden verworfen.", [
      { text: "Weiter", style: "cancel" },
      { text: "Abbrechen", style: "destructive", onPress: async () => { timer.stop(); await store.cancel(api); router.back() } },
    ])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + space[2], paddingHorizontal: space[4], paddingBottom: space[2], flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <Text variant="title3" numberOfLines={1}>
            {workout.name}
          </Text>
          <Text variant="footnote" color="secondary">
            {formatTimer(elapsed)} · {doneSets} Sätze · {formatTonnage(tonnage, unit)}
            {store.pending ? ` · ${store.sync === "offline" ? "offline" : "sync"} (${store.pending})` : ""}
          </Text>
        </View>
        <Button title={workout.status === "paused" ? "Weiter" : "Pause"} variant="secondary" size="sm" onPress={() => (workout.status === "paused" ? store.resume(api) : store.pause(api))} />
        <Button title="Beenden" size="sm" loading={finishing} onPress={finish} hapticStyle="medium" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space[4], gap: space[2], paddingBottom: space[2] }} style={{ flexGrow: 0 }}>
        {visible.map((e, i) => {
          const done = e.sets.filter(s => s.completed).length
          const total = e.sets.length
          return <Chip key={e.id} label={`${i + 1} · ${done}/${total}`} size="sm" selected={focusIndex === i} tone={done >= total && total > 0 ? "success" : "default"} onPress={() => setFocusIndex(i)} />
        })}
      </ScrollView>

      <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: 200, gap: space[3] }} keyboardShouldPersistTaps="handled" bottomOffset={120}>
        {workout.status === "paused" ? (
          <Card tone="muted">
            <Text variant="calloutStrong">Workout pausiert</Text>
            <Text variant="footnote" color="secondary">
              Die Zeit läuft nicht weiter. Tippe oben auf „Weiter“.
            </Text>
          </Card>
        ) : null}
        {visible.length === 0 ? <EmptyState icon="plus.circle" title="Noch keine Übungen" body="Füge unten Übungen hinzu – aus der Bibliothek, mit Suche und Filtern." /> : null}
        {visible.map((ex, i) => {
          const prevWorking = ex.previous?.sets.filter(s => s.setType !== "warmup") ?? []
          let workingIdx = -1
          return (
            <Card key={ex.id} padding="sm" style={{ borderColor: focusIndex === i ? colors.accent : colors.border, borderWidth: focusIndex === i ? 1.5 : 0.5 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[1], marginBottom: space[1] }}>
                {focusIndex === i ? <ExerciseAnimation slug={slugFor(ex)} style={{ width: 84, borderRadius: 10 }} showIndicator={false} /> : <ExerciseThumbnail slug={slugFor(ex)} size={84} />}
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {ex.exerciseNameSnapshot}
                  </Text>
                  <Text variant="footnote" color="secondary">
                    {ex.targetSets ? `${ex.targetSets} × ${ex.targetRepsMin ?? "?"}–${ex.targetRepsMax ?? "?"}` : "frei"}
                    {ex.targetRir !== null ? ` · RIR ${ex.targetRir}` : ""} · Pause {ex.restSeconds ?? defaultRest} s
                    {ex.previous ? ` · zuletzt ${new Date(ex.previous.performedAt).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}` : ""}
                  </Text>
                </View>
                <Button title="···" variant="ghost" size="sm" onPress={() => exerciseOptions(ex)} hapticStyle="none" />
              </View>
              <View style={{ flexDirection: "row", paddingHorizontal: space[1], gap: space[2], marginBottom: 2 }}>
                <Text variant="caption" color="tertiary" style={{ width: 34 }} align="center">SATZ</Text>
                <Text variant="caption" color="tertiary" style={{ width: 64 }} align="center">ZULETZT</Text>
                <Text variant="caption" color="tertiary" style={{ flex: 1.3 }} align="center">{unit.toUpperCase()}</Text>
                <Text variant="caption" color="tertiary" style={{ flex: 1 }} align="center">WDH.</Text>
                <View style={{ width: 44 }} />
              </View>
              {ex.sets.map(set => {
                if (set.setType !== "warmup") workingIdx += 1
                const prev = set.setType === "warmup" ? null : (prevWorking[workingIdx] ?? prevWorking[prevWorking.length - 1] ?? null)
                return <SetRow key={set.id} set={set} unit={unit} previous={prev} stepGrams={stepFor(ex)} onChange={patch => changeSet(ex, set, patch)} onComplete={() => { setFocusIndex(i); completeSet(ex, set) }} onLongPress={() => setOptions(ex, set)} />
              })}
              <Button title="+ Satz" variant="ghost" size="sm" onPress={() => store.addSet(api, ex)} hapticStyle="selection" />
            </Card>
          )
        })}
        <Button title="Übung hinzufügen" variant="secondary" fullWidth onPress={() => { picker.open({ title: "Übung hinzufügen", onPick: e => store.addExercise(api, e, { restSeconds: defaultRest }) }); router.push("/workout/pick-exercise") }} />
        <Button title="Workout abbrechen" variant="ghost" onPress={cancel} />
      </KeyboardAwareScrollView>

      <View style={{ position: "absolute", left: space[4], right: space[4], bottom: insets.bottom + space[3] }}>
        <RestTimerBar />
      </View>
    </View>
  )
}
