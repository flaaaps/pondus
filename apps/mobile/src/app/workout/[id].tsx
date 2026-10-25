import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActionSheetIOS, Alert, Pressable, ScrollView, View, useWindowDimensions } from "react-native"
import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from "react-native-keyboard-controller"
import { useKeepAwake } from "expo-keep-awake"
import type { WorkoutExerciseDto, WorkoutSetDto } from "@pondus/shared"
import { DEFAULT_INCREMENT_GRAMS, formatWeight, warmupLadder, type WeightUnit } from "@pondus/shared"
import { Button, Card, Chip, EmptyState, GlassSurface, Text, useTheme } from "@/design-system"
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

type PrevSet = { weightGrams: number | null; reps: number | null }

/** Last time's value for a set: matched by working-set index, warm-ups have none. */
function previousFor(ex: WorkoutExerciseDto, set: WorkoutSetDto): PrevSet | null {
  if (set.setType === "warmup") return null
  const prevWorking = ex.previous?.sets.filter(s => s.setType !== "warmup") ?? []
  const idx = ex.sets.filter(s => s.setType !== "warmup").findIndex(s => s.id === set.id)
  return prevWorking[idx] ?? prevWorking[prevWorking.length - 1] ?? null
}


/** Short badge for the progression target: "↑ +2,5 kg", "↑ Wdh.", "= halten", "↓ Deload". Null when there is nothing to show. */
function targetBadge(t: WorkoutExerciseDto["nextTarget"], unit: WeightUnit, assisted: boolean): { label: string; tone: "success" | "default" | "warning"; a11y: string } | null {
  if (!t || t.kind === "no_data") return null
  if (t.kind === "increase_load") {
    const diff = t.weightGrams !== null && t.lastWeightGrams !== null ? t.weightGrams - t.lastWeightGrams : null
    // Assisted: less assistance is the progression, so the difference is negative.
    const text = diff ? `${diff > 0 ? "+" : "−"}${formatWeight(Math.abs(diff), unit)}${assisted ? " Unterst." : ""}` : "mehr Gewicht"
    return { label: `↑ ${text}`, tone: "success", a11y: `Ziel: ${assisted ? "weniger Unterstützung" : "mehr Gewicht"}${diff ? `, ${formatWeight(Math.abs(diff), unit)}` : ""}` }
  }
  if (t.kind === "increase_reps") return { label: "↑ Wdh.", tone: "success", a11y: "Ziel: mehr Wiederholungen" }
  if (t.kind === "hold") return { label: "= halten", tone: "default", a11y: "Ziel: Gewicht halten" }
  return { label: "↓ Deload", tone: "warning", a11y: "Ziel: Deload, leichter trainieren" }
}

/**
 * The active workout. Local-first: every tap updates SQLite immediately and
 * is queued for the server. Built for one hand: the main action ("tick off
 * the next set"), pause and finish sit in a glass bar at the bottom; the rest
 * timer floats right above it. Keeps the screen awake; the keyboard never
 * covers the active row (KeyboardAwareScrollView).
 */
export default function ActiveWorkoutScreen() {
  useKeepAwake()
  const { colors, space, radius } = useTheme()
  const insets = useSafeAreaInsets()
  const { fontScale } = useWindowDimensions()
  const router = useRouter()
  const api = useApi()
  const store = useActiveWorkoutStore()
  const workout = store.workout
  const elapsed = useElapsed(workout)
  const unit = useSettingsStore(s => s.weightUnit)
  const defaultRest = useSettingsStore(s => s.defaultRestSeconds)
  const timer = useRestTimerStore()
  const timerActive = timer.endsAt !== null || timer.remainingWhenPaused !== null
  const picker = useExercisePicker()
  const library = useAllExercises()
  const [focusIndex, setFocusIndex] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [rirSetId, setRirSetId] = useState<string | null>(null)
  const [undoSkip, setUndoSkip] = useState<WorkoutExerciseDto | null>(null)
  const [openReason, setOpenReason] = useState<string | null>(null)
  const [bottomBarHeight, setBottomBarHeight] = useState(160)
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null)
  const cardY = useRef(new Map<string, number>())
  const libraryById = useMemo(() => new Map((library.data ?? []).map(e => [e.id, e])), [library.data])
  // The set column grows only slightly with Dynamic Type (its labels shrink to fit instead), so the
  // weight/reps fields keep enough room for three digits even at the largest text sizes.
  const setColumnWidth = Math.round(52 * Math.min(Math.max(fontScale, 1), 1.1))

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

  const assistedFor = useCallback((ex: WorkoutExerciseDto) => (ex.exerciseId ? libraryById.get(ex.exerciseId)?.loadType === "assisted" : false), [libraryById])
  /** Warm-up suggestions (40/60/80 % of the working weight), matched to the warm-up rows. Not for assisted/body weight. */
  const warmupsFor = useCallback(
    (ex: WorkoutExerciseDto) => {
      const count = ex.sets.filter(s => s.setType === "warmup").length
      if (!count || assistedFor(ex)) return []
      const working = ex.nextTarget?.weightGrams ?? ex.sets.find(s => s.setType !== "warmup" && s.weightGrams !== null)?.weightGrams ?? null
      return working ? warmupLadder(working, stepFor(ex), { sets: count }) : []
    },
    [assistedFor, stepFor],
  )

  useEffect(() => {
    if (!undoSkip) return
    const t = setTimeout(() => setUndoSkip(null), 6000)
    return () => clearTimeout(t)
  }, [undoSkip])

  if (!workout) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <EmptyState icon="figure.strengthtraining.traditional" title="Kein aktives Workout" actionTitle="Zurück" onAction={() => router.back()} />
      </View>
    )
  }
  const visible = workout.exercises.filter(e => !e.skipped)
  const skipped = workout.exercises.filter(e => e.skipped)
  const allSets = visible.flatMap(e => e.sets)
  const doneSets = allSets.filter(s => s.completed && s.setType !== "warmup").length
  const tonnage = tonnageGrams(allSets.map(s => ({ setType: s.setType, weightGrams: s.weightGrams, reps: s.reps, completed: s.completed })))
  const paused = workout.status === "paused"
  const safeFocus = Math.min(focusIndex, Math.max(0, visible.length - 1))

  /** Caption under the set number: last session's value, or for warm-ups the suggested ladder step. */
  const hintFor = (ex: WorkoutExerciseDto, set: WorkoutSetDto): { value: PrevSet | null; kind: "previous" | "warmup" } => {
    if (set.setType !== "warmup") return { value: previousFor(ex, set), kind: "previous" }
    const step = warmupsFor(ex)[ex.sets.filter(s => s.setType === "warmup").findIndex(s => s.id === set.id)]
    return { value: step ? { weightGrams: step.weightGrams, reps: step.reps } : null, kind: "warmup" }
  }
  const targetFor = (ex: WorkoutExerciseDto, set: WorkoutSetDto) =>
    ex.nextTarget && ex.nextTarget.kind !== "no_data" && set.setType !== "warmup" && (set.targetWeightGrams !== null || set.targetReps !== null) ? { weightGrams: set.targetWeightGrams, reps: set.targetReps } : null

  const scrollToExercise = (index: number) => {
    const ex = visible[index]
    const y = ex ? cardY.current.get(ex.id) : undefined
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - space[2]), animated: true })
  }
  const focusExercise = (index: number, scroll = true) => {
    setFocusIndex(index)
    if (scroll) scrollToExercise(index)
  }

  /** The set the big bottom button ticks off: first open set of the focused exercise, else of the next exercise with open sets. */
  const nextOpen = (() => {
    const order = [...visible.slice(safeFocus), ...visible.slice(0, safeFocus)]
    for (const ex of order) {
      const set = ex.sets.find(s => !s.completed)
      if (set) return { ex, set, index: visible.indexOf(ex) }
    }
    return null
  })()

  const completeSet = (ex: WorkoutExerciseDto, set: WorkoutSetDto) => {
    const completed = !set.completed
    haptic(completed ? "success" : "light")
    const patch: Partial<WorkoutSetDto> = { completed, completedAt: completed ? new Date().toISOString() : null }
    if (completed && (set.weightGrams === null || set.reps === null)) {
      // Ticking off an empty field takes over the last value: the previous set of this exercise, else last time's.
      const earlier = [...ex.sets.slice(0, ex.sets.indexOf(set))].reverse().find(s => s.setType === set.setType && (s.weightGrams !== null || s.reps !== null))
      const source = earlier ?? hintFor(ex, set).value
      if (set.weightGrams === null && source?.weightGrams != null) patch.weightGrams = source.weightGrams
      if (set.reps === null && source?.reps != null) patch.reps = source.reps
    }
    store.upsertSet(api, ex, { ...patch, clientId: set.clientId ?? set.id, setNumber: set.setNumber })
    setRirSetId(completed && set.setType !== "warmup" ? set.id : null)
    if (completed && set.setType !== "warmup") timer.start(ex.restSeconds ?? defaultRest, ex.exerciseNameSnapshot)
    const index = visible.indexOf(ex)
    if (completed && ex.sets.every(s => s.id === set.id || s.completed)) {
      // Last set of this exercise: move on to the next one with open sets.
      const next = visible.findIndex((e, i) => i > index && e.sets.some(s => !s.completed))
      if (next >= 0) setTimeout(() => focusExercise(next), 350)
    } else if (index >= 0) setFocusIndex(index)
  }
  const changeSet = (ex: WorkoutExerciseDto, set: WorkoutSetDto, patch: Partial<WorkoutSetDto>) => {
    // Edits to not-yet-completed sets stay local (but persisted) until completion; completed sets sync immediately.
    if (!set.completed) return store.updateLocalSet(ex.id, set.id, patch)
    store.upsertSet(api, ex, { ...patch, clientId: set.clientId ?? set.id, setNumber: set.setNumber })
  }
  const setOptions = (ex: WorkoutExerciseDto, set: WorkoutSetDto) =>
    ActionSheetIOS.showActionSheetWithOptions({ title: `Satz ${set.setNumber}`, options: ["Abbrechen", "RIR setzen (0–4)", "Satz löschen"], cancelButtonIndex: 0, destructiveButtonIndex: 2 }, idx => {
      if (idx === 2) store.deleteSet(api, set)
      if (idx === 1) ActionSheetIOS.showActionSheetWithOptions({ title: "Wiederholungen in Reserve", options: ["Abbrechen", "0 – am Limit", "1", "2", "3", "4+"], cancelButtonIndex: 0 }, r => r > 0 && changeSet(ex, set, { rir: r - 1 }))
    })
  const skip = (ex: WorkoutExerciseDto) => {
    store.skipExercise(api, ex, true)
    setUndoSkip(ex)
    haptic("light")
  }
  const restore = (ex: WorkoutExerciseDto) => {
    store.skipExercise(api, ex, false)
    setUndoSkip(null)
    haptic("selection")
  }
  const exerciseOptions = (ex: WorkoutExerciseDto) =>
    ActionSheetIOS.showActionSheetWithOptions({ title: ex.exerciseNameSnapshot, options: ["Abbrechen", "Übung austauschen (nur heute)", "Pause für diese Übung ändern", "Übung überspringen"], cancelButtonIndex: 0, destructiveButtonIndex: 3 }, idx => {
      if (idx === 1) {
        picker.open({ title: `${ex.exerciseNameSnapshot} ersetzen`, alternativesFor: ex.exerciseId ?? undefined, onPick: e => store.addExercise(api, e, { replaces: ex }) })
        router.push("/workout/pick-exercise")
      } else if (idx === 2) {
        ActionSheetIOS.showActionSheetWithOptions({ title: "Pausendauer", options: ["Abbrechen", "60 s", "90 s", "120 s", "150 s", "180 s", "240 s"], cancelButtonIndex: 0 }, r => r > 0 && store.dispatch(api, { kind: "update_exercise", workoutClientId: workout.clientId ?? workout.id, exerciseClientId: ex.clientId ?? ex.id, body: { restSeconds: [60, 90, 120, 150, 180, 240][r - 1]! } }))
      } else if (idx === 3) skip(ex)
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
  const togglePause = () => (paused ? store.resume(api) : store.pause(api))

  const RoundAction = ({ icon, label, onPress }: { icon: Parameters<typeof SymbolView>[0]["name"]; label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { haptic("selection"); onPress() }} style={({ pressed }) => ({ width: 56, minHeight: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: pressed ? colors.surfaceMuted : "transparent" })}>
      <SymbolView name={icon} size={20} weight="semibold" tintColor={colors.textPrimary} accessibilityElementsHidden importantForAccessibility="no" />
      <Text variant="caption" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </Pressable>
  )

  const primary = nextOpen
    ? {
        title: nextOpen.set.setType === "warmup" ? "Aufwärmsatz abhaken" : `Satz ${nextOpen.set.setNumber} abhaken`,
        subtitle: nextOpen.ex.exerciseNameSnapshot,
        a11y: `${nextOpen.ex.exerciseNameSnapshot}, Satz ${nextOpen.set.setNumber} abschließen`,
        onPress: () => completeSet(nextOpen.ex, nextOpen.set),
      }
    : { title: "Workout beenden", subtitle: `${doneSets} Arbeitssätze`, a11y: "Workout beenden", onPress: finish }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + space[2], paddingHorizontal: space[4], paddingBottom: space[2] }}>
        <Text variant="title3" numberOfLines={2} accessibilityRole="header">
          {workout.name}
        </Text>
        <Text variant="footnote" color="secondary">
          {formatTimer(elapsed)} · {doneSets} Sätze · {formatTonnage(tonnage, unit)}
          {paused ? " · pausiert" : ""}
          {store.pending ? ` · ${store.sync === "offline" ? "offline" : "sync"} (${store.pending})` : ""}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space[4], gap: space[2], paddingBottom: space[2] }} style={{ flexGrow: 0 }}>
        {visible.map((e, i) => {
          const done = e.sets.filter(s => s.completed).length
          const total = e.sets.length
          return <Chip key={e.id} label={`${i + 1} · ${done}/${total}`} accessibilityLabel={`Übung ${i + 1}, ${e.exerciseNameSnapshot}, ${done} von ${total} Sätzen`} size="sm" selected={safeFocus === i} tone={done >= total && total > 0 ? "success" : "default"} onPress={() => focusExercise(i)} />
        })}
      </ScrollView>

      <KeyboardAwareScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: bottomBarHeight + insets.bottom + space[6], gap: space[3] }} keyboardShouldPersistTaps="handled" bottomOffset={bottomBarHeight}>
        {paused ? (
          <Card tone="muted">
            <Text variant="calloutStrong">Workout pausiert</Text>
            <Text variant="footnote" color="secondary">
              Die Zeit läuft nicht weiter. Tippe unten auf „Weiter“.
            </Text>
          </Card>
        ) : null}
        {visible.length === 0 ? <EmptyState icon="plus.circle" title="Noch keine Übungen" body="Füge unten Übungen hinzu – aus der Bibliothek, mit Suche und Filtern." /> : null}
        {visible.map((ex, i) => {
          const focused = safeFocus === i
          const assisted = assistedFor(ex)
          const badge = targetBadge(ex.nextTarget, unit, assisted)
          return (
            <View key={ex.id} onLayout={e => cardY.current.set(ex.id, e.nativeEvent.layout.y)}>
              <Card padding="sm" style={{ borderColor: focused ? colors.accent : colors.border, borderWidth: focused ? 1.5 : 0.5 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[1], marginBottom: space[1] }}>
                  {focused ? <ExerciseAnimation slug={slugFor(ex)} style={{ width: 84, borderRadius: 10 }} showIndicator={false} /> : <ExerciseThumbnail slug={slugFor(ex)} size={84} />}
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={2} accessibilityRole="header">
                      {ex.exerciseNameSnapshot}
                    </Text>
                    <Text variant="footnote" color="secondary">
                      {ex.targetSets ? `${ex.targetSets} × ${ex.targetRepsMin ?? "?"}–${ex.targetRepsMax ?? "?"}` : "frei"}
                      {ex.targetRir !== null ? ` · RIR ${ex.targetRir}` : ""} · Pause {ex.restSeconds ?? defaultRest} s
                      {ex.previous ? ` · zuletzt ${new Date(ex.previous.performedAt).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}` : ""}
                    </Text>
                    {badge ? (
                      <View style={{ flexDirection: "row", marginTop: space[1] }}>
                        <Chip size="sm" label={badge.label} tone={badge.tone} accessibilityLabel={`${badge.a11y}. Begründung ${openReason === ex.id ? "ausblenden" : "anzeigen"}`} onPress={() => setOpenReason(openReason === ex.id ? null : ex.id)} />
                      </View>
                    ) : null}
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Optionen für ${ex.exerciseNameSnapshot}`} onPress={() => exerciseOptions(ex)} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
                    <SymbolView name="ellipsis.circle" size={24} tintColor={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
                  </Pressable>
                </View>
                {badge && openReason === ex.id ? (
                  <Text variant="footnote" color="secondary" style={{ paddingHorizontal: space[1], marginBottom: space[2] }}>
                    {ex.nextTarget!.reason}
                  </Text>
                ) : null}
                <View style={{ flexDirection: "row", paddingHorizontal: space[1], gap: space[2], marginBottom: 2 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  {[
                    { label: "SATZ", style: { width: setColumnWidth } },
                    { label: assisted ? `UNTERST. ${unit.toUpperCase()}` : unit.toUpperCase(), style: { flex: 1.3 } },
                    { label: "WDH.", style: { flex: 1 } },
                  ].map(c => (
                    <Text key={c.label} variant="caption" color="tertiary" style={c.style} align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {c.label}
                    </Text>
                  ))}
                  <View style={{ width: 44 }} />
                </View>
                {ex.sets.map(set => (
                  <SetRow
                    key={set.id}
                    set={set}
                    unit={unit}
                    previous={hintFor(ex, set).value}
                    previousKind={hintFor(ex, set).kind}
                    target={targetFor(ex, set)}
                    assisted={assisted}
                    stepGrams={stepFor(ex)}
                    setColumnWidth={setColumnWidth}
                    onChange={patch => changeSet(ex, set, patch)}
                    onComplete={() => completeSet(ex, set)}
                    onLongPress={() => setOptions(ex, set)}
                    rirPrompt={rirSetId === set.id && set.completed}
                    onRir={rir => {
                      changeSet(ex, set, { rir })
                      setRirSetId(null)
                    }}
                  />
                ))}
                <Button title="+ Satz" variant="ghost" size="sm" accessibilityLabel={`Satz zu ${ex.exerciseNameSnapshot} hinzufügen`} onPress={() => store.addSet(api, ex)} hapticStyle="selection" />
              </Card>
            </View>
          )
        })}
        {skipped.length ? (
          <Card tone="muted" padding="sm">
            <Text variant="calloutStrong" color="secondary" style={{ paddingHorizontal: space[1], marginBottom: space[1] }}>
              ÜBERSPRUNGEN
            </Text>
            {skipped.map(ex => (
              <View key={ex.id} style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[1] }}>
                <Text variant="body" color="secondary" numberOfLines={2} style={{ flex: 1 }}>
                  {ex.exerciseNameSnapshot}
                </Text>
                <Button title="Wiederherstellen" variant="ghost" size="sm" accessibilityLabel={`${ex.exerciseNameSnapshot} wiederherstellen`} onPress={() => restore(ex)} hapticStyle="none" />
              </View>
            ))}
          </Card>
        ) : null}
        <Button title="Übung hinzufügen" variant="secondary" fullWidth onPress={() => { picker.open({ title: "Übung hinzufügen", onPick: e => store.addExercise(api, e, { restSeconds: defaultRest }) }); router.push("/workout/pick-exercise") }} />
        <Button title="Workout abbrechen" variant="ghost" onPress={cancel} style={{ alignSelf: "center" }} />
      </KeyboardAwareScrollView>

      <View pointerEvents="box-none" onLayout={e => setBottomBarHeight(e.nativeEvent.layout.height)} style={{ position: "absolute", left: space[3], right: space[3], bottom: insets.bottom + space[2], gap: space[2] }}>
        {undoSkip ? (
          <GlassSurface style={{ paddingVertical: space[1], paddingLeft: space[4], paddingRight: space[1], flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Text variant="callout" numberOfLines={2} style={{ flex: 1 }} accessibilityLiveRegion="polite">
              „{undoSkip.exerciseNameSnapshot}“ übersprungen
            </Text>
            <Button title="Rückgängig" variant="ghost" size="sm" onPress={() => restore(undoSkip)} hapticStyle="none" />
          </GlassSurface>
        ) : null}
        {timerActive ? <RestTimerBar /> : null}
        <GlassSurface interactive style={{ padding: space[2], flexDirection: "row", alignItems: "center", gap: space[1] }}>
          <RoundAction icon={paused ? "play.fill" : "pause.fill"} label={paused ? "Weiter" : "Pause"} onPress={togglePause} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={primary.a11y}
            accessibilityState={{ busy: finishing }}
            disabled={finishing}
            onPress={() => {
              haptic("medium")
              primary.onPress()
            }}
            style={({ pressed }) => ({ flex: 1, minHeight: 56, borderRadius: radius.pill, backgroundColor: pressed ? colors.accentPressed : colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: space[3], paddingVertical: space[1], opacity: finishing ? 0.6 : 1 })}
          >
            <Text variant="bodyStrong" color="onAccent" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.3}>
              {primary.title}
            </Text>
            <Text variant="caption" color="onAccent" numberOfLines={1} style={{ opacity: 0.85 }} maxFontSizeMultiplier={1.2}>
              {primary.subtitle}
            </Text>
          </Pressable>
          {nextOpen ? <RoundAction icon="flag.checkered" label="Beenden" onPress={finish} /> : null}
        </GlassSurface>
      </View>
    </View>
  )
}
