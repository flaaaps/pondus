import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  ActionSheetIOS,
  Alert,
  Keyboard,
  View,
  useWindowDimensions,
} from "react-native"
import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  KeyboardAwareScrollView,
  KeyboardToolbar,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller"
import { useKeepAwake } from "expo-keep-awake"
import {
  tonnageGrams,
  type SetType,
  type WorkoutExerciseDto,
  type WorkoutSetDto,
} from "@pondus/shared"
import { Button, Card, EmptyState, Stat, Text, palette, useTheme } from "@/design-system"
import { SetEditor } from "@/components/workout/SetEditor"
import { SetList } from "@/components/workout/SetList"
import { WorkoutDock, type DockAction } from "@/components/workout/WorkoutDock"
import { WorkoutTopBar } from "@/components/workout/WorkoutTopBar"
import { ExerciseHeader } from "@/components/workout/ExerciseHeader"
import { FirstTimeCard, IntroCard, RirCard } from "@/components/workout/ContextCards"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useWorkoutUiStore } from "@/features/workout/workout-ui-store"
import {
  completionPatch,
  deriveScreenState,
  effectiveValues,
  formatKg,
  formatSet,
  isBodyweight,
  isFirstTime,
  isWarmup,
  keyOf,
  nextExerciseWithOpenSets,
  nextOpenSet,
  numberFor,
  visibleExercises,
  warmupIndexFor,
  type LibraryLookup,
  type Values,
} from "@/features/workout/selectors"
import { useElapsed } from "@/features/workout/use-elapsed"
import { useExercisePicker } from "@/features/exercises/picker-store"
import { useAllExercises } from "@/features/exercises/queries"
import { useApi } from "@/services/session-store"
import { useRestTimerStore } from "@/services/rest-timer-store"
import { useSettingsStore } from "@/services/settings-store"
import { formatTimer, formatTonnage, SET_TYPE_LABELS } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import type { GuideSection } from "./guide"

const SET_TYPE_CHOICES: SetType[] = ["warmup", "working", "drop", "failure"]
const REST_CHOICES = [60, 90, 120, 150, 180, 240]
const ADVANCE_DELAY = 600
const KEYBOARD_TOOLBAR_THEME = {
  light: { primary: palette.ember600, disabled: palette.ink400, background: palette.ink100, ripple: palette.ink200 },
  dark: { primary: palette.ember400, disabled: palette.ink500, background: palette.ink800, ripple: palette.ink700 },
}

/**
 * The active workout, focused: one exercise and one set at a time. The set
 * editor shows the set you are about to do; the single big button in the
 * glass dock ticks off exactly that set. The other exercises are one tap away
 * (‹ › or the overview sheet). Local-first: every change lands in SQLite
 * immediately and is queued for the server.
 */
export default function ActiveWorkoutScreen() {
  useKeepAwake()
  const { colors, space } = useTheme()
  const insets = useSafeAreaInsets()
  const { fontScale, height } = useWindowDimensions()
  const compact = fontScale >= 1.3 || height < 700
  const router = useRouter()
  const api = useApi()
  const store = useActiveWorkoutStore()
  const workout = store.workout
  const elapsed = useElapsed(workout)
  const unit = useSettingsStore(s => s.weightUnit)
  const defaultRest = useSettingsStore(s => s.defaultRestSeconds)
  const introSeen = useSettingsStore(s => s.workoutIntroSeen)
  const setIntroSeen = useSettingsStore(s => s.setWorkoutIntroSeen)
  const timer = useRestTimerStore()
  const ui = useWorkoutUiStore()
  const picker = useExercisePicker()
  const library = useAllExercises()
  const [dockHeight, setDockHeight] = useState(140)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [upNextKey, setUpNextKey] = useState<string | null>(null)
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null)
  const editorY = useRef(0)
  const libraryById = useMemo(
    () => new Map((library.data ?? []).map(e => [e.id, e])),
    [library.data],
  )
  const lookup: LibraryLookup = useCallback(
    id => (id ? libraryById.get(id) : undefined),
    [libraryById],
  )

  const workoutKey = workout ? keyOf(workout) : null
  useEffect(() => {
    useWorkoutUiStore.getState().reset()
  }, [workoutKey])
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardOpen(true))
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardOpen(false))
    return () => {
      show.remove()
      hide.remove()
      if (advance.current) clearTimeout(advance.current)
    }
  }, [])
  // A new exercise in focus starts at the top; a running rest timer now leads into that exercise.
  const focusedKey = ui.focusedExerciseKey ?? (workout ? keyOf(visibleExercises(workout).find(e => e.sets.some(s => !s.completed)) ?? workout) : null)
  useEffect(() => {
    if (!focusedKey) return
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    const t = useRestTimerStore.getState()
    const name = useActiveWorkoutStore.getState().workout?.exercises.find(e => keyOf(e) === focusedKey)?.exerciseNameSnapshot
    if (name && (t.endsAt !== null || t.remainingWhenPaused !== null)) t.setLabel(name)
  }, [focusedKey])
  // Toasts expire on their own.
  useEffect(() => {
    if (!ui.toast) return
    const id = ui.toast.id
    const t = setTimeout(
      () => useWorkoutUiStore.getState().hideToast(id),
      ui.toast.kind === "undoSkip" ? 6000 : 5000,
    )
    return () => clearTimeout(t)
  }, [ui.toast])

  if (!workout) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <EmptyState
          icon="figure.strengthtraining.traditional"
          title="Kein aktives Workout"
          actionTitle="Zurück"
          onAction={() => router.back()}
        />
      </View>
    )
  }

  const visible = visibleExercises(workout)
  const skipped = workout.exercises.filter(e => e.skipped)
  const focused =
    visible.find(e => keyOf(e) === ui.focusedExerciseKey) ??
    visible.find(e => e.sets.some(s => !s.completed)) ??
    visible[0] ??
    null
  const focusedIndex = focused ? visible.indexOf(focused) : 0
  const selected = focused
    ? (focused.sets.find(s => keyOf(s) === ui.selectedSetKey) ?? nextOpenSet(focused))
    : null
  const state = deriveScreenState(workout, focused, selected)
  const allSets = visible.flatMap(e => e.sets)
  const doneSets = allSets.filter(s => s.completed && !isWarmup(s)).length
  const totalSets = allSets.filter(s => !isWarmup(s)).length
  const draft = selected && ui.editDraft?.setKey === keyOf(selected) ? ui.editDraft : null
  const values: Values =
    !focused || !selected
      ? { weightGrams: null, reps: null }
      : state === "editingDone"
        ? (draft ?? { weightGrams: selected.weightGrams, reps: selected.reps })
        : effectiveValues(focused, selected, lookup)
  const slugFor = (ex: WorkoutExerciseDto) =>
    ex.exerciseId ? libraryById.get(ex.exerciseId)?.slug : undefined
  const setName = (ex: WorkoutExerciseDto, s: WorkoutSetDto) =>
    isWarmup(s) ? `Aufwärmsatz ${warmupIndexFor(ex, s)}` : `Satz ${numberFor(ex, s)}`
  const findSet = (setKey: string) => {
    for (const ex of workout.exercises)
      for (const s of ex.sets) if (keyOf(s) === setKey) return { ex, s }
    return null
  }
  const openGuide = (section?: GuideSection) =>
    router.push({ pathname: "/workout/guide", params: section ? { section } : {} })
  const cancelAdvance = () => {
    if (advance.current) clearTimeout(advance.current)
    advance.current = null
  }
  const focusExercise = (ex: WorkoutExerciseDto | null | undefined) => {
    if (!ex) return
    cancelAdvance()
    setUpNextKey(null)
    ui.focusExercise(keyOf(ex))
  }

  // --- set editing ---------------------------------------------------------
  const changeValues = (patch: Partial<Values>) => {
    if (!focused || !selected) return
    if (state === "editingDone")
      return ui.setEditDraft({ setKey: keyOf(selected), ...values, ...patch })
    store.updateLocalSet(focused.id, selected.id, patch)
  }
  const writeSet = (ex: WorkoutExerciseDto, s: WorkoutSetDto, patch: Partial<WorkoutSetDto>) => {
    if (!s.completed) return store.updateLocalSet(ex.id, s.id, patch)
    store.upsertSet(api, ex, { ...patch, clientId: keyOf(s), setNumber: s.setNumber })
  }
  const chooseType = (ex: WorkoutExerciseDto, s: WorkoutSetDto) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Satztyp · jetzt: ${SET_TYPE_LABELS[s.setType]}`,
        options: ["Abbrechen", ...SET_TYPE_CHOICES.map(t => SET_TYPE_LABELS[t]!)],
        cancelButtonIndex: 0,
      },
      i => {
        const t = SET_TYPE_CHOICES[i - 1]
        if (!t || t === s.setType) return
        haptic("selection")
        writeSet(ex, s, { setType: t })
      },
    )
  const chooseRir = (ex: WorkoutExerciseDto, s: WorkoutSetDto) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Wiederholungen in Reserve",
        options: ["Abbrechen", "0 – am Limit", "1", "2", "3", "4+"],
        cancelButtonIndex: 0,
      },
      r => r > 0 && writeSet(ex, s, { rir: r - 1 }),
    )

  const completeSelected = () => {
    if (!focused || !selected) return
    const ex = focused
    const s = selected
    const patch = completionPatch(ex, s, lookup)
    store.upsertSet(api, ex, { ...patch, clientId: keyOf(s), setNumber: s.setNumber })
    haptic("success")
    setUpNextKey(null)
    // Carry on after this set (you may have started with a later one); null = first open set.
    const following = nextOpenSet(ex, s)
    ui.selectSet(following ? keyOf(following) : null)
    const exerciseFinished = ex.sets.every(x => x.completed || keyOf(x) === keyOf(s))
    const next = exerciseFinished ? nextExerciseWithOpenSets(visible, keyOf(ex)) : ex
    const rest = ex.restSeconds ?? defaultRest
    if (!isWarmup(s)) timer.start(rest, next?.exerciseNameSnapshot ?? undefined)
    ui.setRirPending(!isWarmup(s) && s.setType !== "failure" ? keyOf(s) : null)
    if (exerciseFinished) {
      ui.showToast({
        kind: "exerciseDone",
        exerciseKey: keyOf(ex),
        label: `${ex.exerciseNameSnapshot} fertig`,
      })
      if (next) {
        cancelAdvance()
        advance.current = setTimeout(() => {
          haptic("medium")
          useWorkoutUiStore.getState().focusExercise(keyOf(next))
          setUpNextKey(keyOf(next))
        }, ADVANCE_DELAY)
      }
    } else
      ui.showToast({
        kind: "undoComplete",
        exerciseKey: keyOf(ex),
        setKey: keyOf(s),
        label: `${setName(ex, s)} abgehakt`,
      })
    const v = `${formatKg(patch.weightGrams ?? null, unit)} mal ${patch.reps ?? "–"}`
    AccessibilityInfo.announceForAccessibility(
      `${setName(ex, s)} abgehakt, ${v}.${isWarmup(s) ? "" : ` Pause ${Math.round((rest / 60) * 10) / 10} Minuten.`}`,
    )
  }
  const undoComplete = (setKey: string, exerciseKey: string) => {
    const found = findSet(setKey)
    cancelAdvance()
    setUpNextKey(null)
    ui.hideToast()
    if (!found) return
    store.upsertSet(api, found.ex, {
      completed: false,
      completedAt: null,
      clientId: setKey,
      setNumber: found.s.setNumber,
    })
    timer.stop()
    ui.setRirPending(null)
    ui.focusExercise(exerciseKey)
    ui.selectSet(setKey)
    haptic("light")
  }
  /** Undo for "exercise done": the last completed set of that exercise. */
  const lastCompletedKey = (exerciseKey: string) => {
    const ex = workout.exercises.find(e => keyOf(e) === exerciseKey)
    const done = ex?.sets
      .filter(s => s.completed)
      .sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""))
    return done?.length ? keyOf(done[done.length - 1]!) : null
  }
  const saveEdit = () => {
    if (!focused || !selected) return
    if (draft)
      store.upsertSet(api, focused, {
        weightGrams: draft.weightGrams,
        reps: draft.reps,
        clientId: keyOf(selected),
        setNumber: selected.setNumber,
      })
    haptic("success")
    ui.selectSet(null)
  }

  // --- menus -----------------------------------------------------------------
  const setOptions = (ex: WorkoutExerciseDto, s: WorkoutSetDto) => {
    const items: { label: string; run: () => void; destructive?: boolean }[] = [
      { label: "Satztyp ändern …", run: () => chooseType(ex, s) },
    ]
    if (s.completed && !isWarmup(s))
      items.push({ label: "RIR ändern …", run: () => chooseRir(ex, s) })
    if (s.completed)
      items.push({
        label: "Als nicht erledigt markieren",
        run: () =>
          store.upsertSet(api, ex, {
            completed: false,
            completedAt: null,
            clientId: keyOf(s),
            setNumber: s.setNumber,
          }),
      })
    items.push({ label: "Satz löschen", destructive: true, run: () => store.deleteSet(api, s) })
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: setName(ex, s),
        options: ["Abbrechen", ...items.map(i => i.label)],
        cancelButtonIndex: 0,
        destructiveButtonIndex: items.findIndex(i => i.destructive) + 1,
      },
      i => i > 0 && items[i - 1]!.run(),
    )
  }
  const addSet = (ex: WorkoutExerciseDto) => {
    store.addSet(api, ex)
    haptic("selection")
    focusExercise(ex)
  }
  const skip = (ex: WorkoutExerciseDto) => {
    store.skipExercise(api, ex, true)
    ui.showToast({
      kind: "undoSkip",
      exerciseKey: keyOf(ex),
      label: `„${ex.exerciseNameSnapshot}“ übersprungen`,
    })
    haptic("light")
    if (focused && keyOf(focused) === keyOf(ex))
      focusExercise(
        nextExerciseWithOpenSets(
          visible.filter(e => keyOf(e) !== keyOf(ex)),
          null,
        ),
      )
  }
  const restore = (exerciseKey: string) => {
    const ex = workout.exercises.find(e => keyOf(e) === exerciseKey)
    if (!ex) return
    store.skipExercise(api, ex, false)
    ui.hideToast()
    ui.focusExercise(exerciseKey)
    haptic("selection")
  }
  const swap = (ex: WorkoutExerciseDto) => {
    picker.open({
      title: `${ex.exerciseNameSnapshot} ersetzen`,
      alternativesFor: ex.exerciseId ?? undefined,
      onPick: e => ui.focusExercise(store.addExercise(api, e, { replaces: ex })),
    })
    router.push("/workout/pick-exercise")
  }
  const addExercise = () => {
    picker.open({
      title: "Übung hinzufügen",
      onPick: e => ui.focusExercise(store.addExercise(api, e, { restSeconds: defaultRest })),
    })
    router.push("/workout/pick-exercise")
  }
  const exerciseOptions = (ex: WorkoutExerciseDto) => {
    const openWarmups = ex.sets.some(s => isWarmup(s) && !s.completed)
    const items: { label: string; run: () => void; destructive?: boolean }[] = [
      { label: "Übung austauschen (nur heute)", run: () => swap(ex) },
      {
        label: "Pause für diese Übung ändern",
        run: () =>
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: "Pausendauer",
              options: [
                "Abbrechen",
                ...REST_CHOICES.map(
                  r => `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")} min`,
                ),
              ],
              cancelButtonIndex: 0,
            },
            r => r > 0 && store.setRestSeconds(api, ex, REST_CHOICES[r - 1]!),
          ),
      },
      { label: "Satz hinzufügen", run: () => addSet(ex) },
      ...(openWarmups
        ? [{ label: "Aufwärmen überspringen", run: () => store.skipOpenWarmups(api, ex) }]
        : []),
      { label: "Übung überspringen", destructive: true, run: () => skip(ex) },
    ]
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: ex.exerciseNameSnapshot,
        options: ["Abbrechen", ...items.map(i => i.label)],
        cancelButtonIndex: 0,
        destructiveButtonIndex: items.findIndex(i => i.destructive) + 1,
      },
      i => i > 0 && items[i - 1]!.run(),
    )
  }
  const paused = workout.status === "paused"
  const togglePause = () => (paused ? store.resume(api) : store.pause(api))
  /** Throws the session away: nothing lands in history, stats, records or progression; the plan day stays open. */
  const discard = () =>
    Alert.alert(
      "Training verwerfen?",
      "Die Einheit wird nicht gespeichert: Sie taucht weder im Verlauf noch in Statistik oder Rekorden auf, und der Trainingstag bleibt offen.",
      [
        { text: "Weiter trainieren", style: "cancel" },
        {
          text: "Verwerfen",
          style: "destructive",
          onPress: async () => {
            timer.stop()
            await store.cancel(api)
            router.back()
          },
        },
      ],
    )
  const complete = async () => {
    timer.stop()
    const { workout: done, serverId } = await store.complete(api)
    haptic("success")
    router.replace({
      pathname: "/workout/summary",
      params: { id: serverId ?? "", local: serverId ? "" : "1", clientId: done.clientId ?? "" },
    })
  }
  const finish = () => {
    const openSets = visible.reduce(
      (n, e) => n + e.sets.filter(s => !s.completed && !isWarmup(s)).length,
      0,
    )
    if (!openSets) return void complete()
    Alert.alert(
      "Workout beenden?",
      `${doneSets} Arbeitssätze protokolliert, ${openSets} offen. Offene Sätze werden nicht gespeichert.`,
      [
        { text: "Weiter trainieren", style: "cancel" },
        { text: "Verwerfen (nicht speichern)", style: "destructive", onPress: discard },
        { text: "Beenden", onPress: () => void complete() },
      ],
    )
  }
  const workoutMenu = () => {
    const items = [
      { label: paused ? "Workout fortsetzen" : "Workout pausieren", run: togglePause },
      { label: "Übersicht", run: () => router.push("/workout/overview") },
      { label: "Übung hinzufügen", run: addExercise },
      { label: "So funktioniert’s", run: () => openGuide() },
      { label: "Training verwerfen", run: discard },
    ]
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Abbrechen", ...items.map(i => i.label)],
        cancelButtonIndex: 0,
        destructiveButtonIndex: items.length,
      },
      i => i > 0 && items[i - 1]!.run(),
    )
  }

  // --- dock ------------------------------------------------------------------
  const nextEx = focused ? nextExerciseWithOpenSets(visible, keyOf(focused)) : null
  let primary: DockAction
  let secondary: DockAction | undefined
  if (state === "paused")
    primary = {
      title: "Weiter trainieren",
      a11y: "Workout fortsetzen",
      icon: "play.fill",
      onPress: togglePause,
    }
  else if (state === "empty")
    primary = { title: "Übung hinzufügen", a11y: "Übung hinzufügen", onPress: addExercise }
  else if (state === "editingDone") {
    primary = {
      title: "Änderungen sichern",
      subtitle: formatSet(values, unit),
      a11y: `Änderungen an ${setName(focused!, selected!)} sichern`,
      icon: "checkmark",
      onPress: saveEdit,
    }
    secondary = {
      title: "Abbrechen",
      a11y: "Bearbeiten abbrechen",
      onPress: () => ui.selectSet(null),
    }
  } else if (state === "ready") {
    const warm = isWarmup(selected!)
    const missing = warm
      ? values.weightGrams === null && values.reps === null
      : values.weightGrams === null && !isBodyweight(focused!, lookup)
    const name = setName(focused!, selected!)
    primary = missing
      ? warm
        ? {
            title: "Ohne Werte abhaken",
            subtitle: name,
            a11y: `${name} ohne Werte abhaken`,
            tone: "secondary",
            icon: "checkmark",
            onPress: completeSelected,
          }
        : {
            title: "Ohne Gewicht abhaken",
            subtitle: `${name} · ${values.reps ?? "–"} Wdh.`,
            a11y: `${name} ohne Gewicht abhaken`,
            tone: "secondary",
            icon: "checkmark",
            onPress: completeSelected,
          }
      : {
          title: `${name} abhaken`,
          subtitle:
            values.weightGrams === null && values.reps === null
              ? undefined
              : `${formatKg(values.weightGrams, unit)} × ${values.reps ?? "–"}`,
          a11y: `${name} abhaken, ${formatKg(values.weightGrams, unit)}, ${values.reps ?? "keine"} Wiederholungen, ${focused!.exerciseNameSnapshot}`,
          icon: "checkmark",
          onPress: completeSelected,
        }
  } else if (state === "exerciseDone")
    primary = {
      title: nextEx ? `Weiter: ${nextEx.exerciseNameSnapshot}` : "Weiter",
      a11y: `Weiter zur nächsten Übung${nextEx ? `, ${nextEx.exerciseNameSnapshot}` : ""}`,
      icon: "arrow.right",
      onPress: () => focusExercise(nextEx),
    }
  else
    primary = {
      title: "Workout beenden",
      subtitle: `${doneSets} Arbeitssätze`,
      a11y: "Workout beenden",
      icon: "flag.checkered",
      onPress: () => void complete(),
    }

  const toast = ui.toast
  const toastNode = toast ? (
    <View
      style={{ paddingLeft: space[2], flexDirection: "row", alignItems: "center", gap: space[1] }}
    >
      {toast.kind === "exerciseDone" ? (
        <SymbolView
          name="checkmark.circle.fill"
          size={20}
          tintColor={colors.success}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      <Text
        variant="callout"
        numberOfLines={2}
        style={{ flex: 1 }}
        accessibilityLiveRegion="polite"
      >
        {toast.label}
      </Text>
      {toast.kind === "exerciseDone" ? (
        <Button
          title="+ Satz"
          variant="ghost"
          size="sm"
          hapticStyle="none"
          onPress={() => {
            const ex = workout.exercises.find(e => keyOf(e) === toast.exerciseKey)
            ui.hideToast()
            if (ex) addSet(ex)
          }}
        />
      ) : null}
      <Button
        title="Rückgängig"
        variant="ghost"
        size="sm"
        hapticStyle="none"
        onPress={() => {
          if (toast.kind === "undoSkip") return restore(toast.exerciseKey)
          const key =
            toast.kind === "undoComplete" ? toast.setKey : lastCompletedKey(toast.exerciseKey)
          if (key) undoComplete(key, toast.exerciseKey)
        }}
      />
    </View>
  ) : null

  const rirSet = ui.rirPendingSetKey ? findSet(ui.rirPendingSetKey) : null
  const volume = (sets: WorkoutSetDto[]) =>
    tonnageGrams(
      sets.map(s => ({
        setType: s.setType,
        weightGrams: s.weightGrams,
        reps: s.reps,
        completed: s.completed,
      })),
    )

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top }}>
        <WorkoutTopBar
          elapsed={formatTimer(elapsed)}
          doneSets={doneSets}
          totalSets={totalSets}
          sync={store.sync}
          pending={store.pending}
          exercises={visible}
          focusedIndex={focusedIndex}
          compact={compact}
          onMenu={workoutMenu}
          onFinish={finish}
          onPrev={() => focusExercise(visible[focusedIndex - 1])}
          onNext={() => focusExercise(visible[focusedIndex + 1])}
          onOverview={() => router.push("/workout/overview")}
        />
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space[4],
          paddingTop: space[2],
          paddingBottom: dockHeight + insets.bottom + space[6],
          gap: space[4],
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={space[6]}
      >
        {!introSeen && focused ? (
          <IntroCard onMore={() => openGuide("logging")} onDismiss={() => setIntroSeen(true)} />
        ) : null}
        {rirSet && rirSet.s.completed ? (
          <RirCard
            setName={setName(rirSet.ex, rirSet.s)}
            value={rirSet.s.rir}
            onPick={rir => {
              store.upsertSet(api, rirSet.ex, {
                rir,
                clientId: keyOf(rirSet.s),
                setNumber: rirSet.s.setNumber,
              })
              ui.setRirPending(null)
            }}
            onDismiss={() => ui.setRirPending(null)}
          />
        ) : null}
        {state === "empty" || !focused ? (
          <EmptyState
            icon="plus.circle"
            title="Noch keine Übungen"
            body="Füge über den Button unten Übungen hinzu – aus der Bibliothek, mit Suche und Filtern."
          />
        ) : null}
        {focused && state !== "workoutDone" ? (
          <ExerciseHeader
            ex={focused}
            slug={slugFor(focused)}
            unit={unit}
            assisted={libraryById.get(focused.exerciseId ?? "")?.loadType === "assisted"}
            defaultRest={defaultRest}
            compact={compact}
            onOptions={() => exerciseOptions(focused)}
            onExplain={() => openGuide("progression")}
          />
        ) : null}
        {focused && isFirstTime(focused) && state === "ready" ? (
          <FirstTimeCard onMore={() => openGuide("first-time")} />
        ) : null}
        {focused && selected && (state === "ready" || state === "editingDone") ? (
          <View onLayout={e => (editorY.current = e.nativeEvent.layout.y)}>
            <SetEditor
              ex={focused}
              set={selected}
              values={values}
              unit={unit}
              lookup={lookup}
              editingDone={state === "editingDone"}
              compact={compact}
              upNext={upNextKey === keyOf(focused) && !focused.sets.some(s => s.completed)}
              onChange={changeValues}
              onTypePress={() => chooseType(focused, selected)}
              onSkipWarmups={() => store.skipOpenWarmups(api, focused)}
              onSelectFirstWorking={() => {
                const first = focused.sets.find(s => !isWarmup(s) && !s.completed)
                if (first) ui.selectSet(keyOf(first))
              }}
            />
          </View>
        ) : null}
        {focused && state === "exerciseDone" ? (
          <Card style={{ alignItems: "center", gap: space[2] }}>
            <SymbolView
              name="checkmark.circle.fill"
              size={44}
              tintColor={colors.success}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text variant="title3">Übung erledigt</Text>
            <Text variant="footnote" color="secondary" align="center">
              {focused.sets.filter(s => s.completed && !isWarmup(s)).length} Arbeitssätze ·{" "}
              {formatTonnage(volume(focused.sets), unit)}. Tippe einen Satz an, um ihn zu
              bearbeiten.
            </Text>
            <Button
              title="+ Satz hinzufügen"
              variant="secondary"
              size="sm"
              onPress={() => addSet(focused)}
            />
          </Card>
        ) : null}
        {state === "workoutDone" ? (
          <View style={{ alignItems: "center", gap: space[3], paddingVertical: space[4] }}>
            <SymbolView
              name="checkmark.circle.fill"
              size={64}
              tintColor={colors.success}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text variant="title1" align="center">
              Alle Sätze erledigt
            </Text>
            <View style={{ flexDirection: "row", gap: space[2], alignSelf: "stretch" }}>
              <Card padding="sm" style={{ flex: 1 }}>
                <Stat label="Dauer" value={formatTimer(elapsed)} />
              </Card>
              <Card padding="sm" style={{ flex: 1 }}>
                <Stat label="Sätze" value={String(doneSets)} />
              </Card>
              <Card padding="sm" style={{ flex: 1 }}>
                <Stat label="Volumen" value={formatTonnage(volume(allSets), unit)} />
              </Card>
            </View>
            <Button title="Übung hinzufügen" variant="secondary" fullWidth onPress={addExercise} />
            <Button
              title="Übersicht ansehen"
              variant="ghost"
              onPress={() => router.push("/workout/overview")}
            />
            {skipped.length ? (
              <Text variant="footnote" color="secondary" align="center">
                {skipped.length} übersprungen – in der Übersicht wiederherstellen.
              </Text>
            ) : null}
          </View>
        ) : null}
        {focused && state !== "workoutDone" && state !== "empty" ? (
          <SetList
            ex={focused}
            selectedKey={
              state === "ready" || state === "editingDone"
                ? selected
                  ? keyOf(selected)
                  : null
                : null
            }
            unit={unit}
            lookup={lookup}
            onSelect={s => {
              ui.selectSet(keyOf(s))
              scrollRef.current?.scrollTo({
                y: Math.max(0, editorY.current - space[2]),
                animated: true,
              })
            }}
            onOptions={s => setOptions(focused, s)}
            onAddSet={() => addSet(focused)}
          />
        ) : null}
      </KeyboardAwareScrollView>

      {paused ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: insets.top + 96,
            bottom: 0,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: space[6],
          }}
        >
          <Card style={{ alignItems: "center", gap: space[3], alignSelf: "stretch" }}>
            <SymbolView
              name="pause.circle.fill"
              size={44}
              tintColor={colors.accent}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text variant="title2">Workout pausiert</Text>
            <Text variant="footnote" color="secondary" align="center">
              Die Zeit steht bei {formatTimer(elapsed)}.
            </Text>
          </Card>
        </View>
      ) : null}

      {keyboardOpen ? null : (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: space[3],
            right: space[3],
            bottom: insets.bottom + space[2],
          }}
        >
          <WorkoutDock
            toast={toastNode}
            primary={primary}
            secondary={secondary}
            compact={compact}
            currentExercise={focused?.exerciseNameSnapshot ?? null}
            onLayout={setDockHeight}
          />
        </View>
      )}
      <KeyboardToolbar doneText="Fertig" showArrows={false} theme={KEYBOARD_TOOLBAR_THEME} />
    </View>
  )
}
