import { AppState } from "react-native"
import { createLiveActivity } from "expo-widgets"
import { create } from "zustand"
import type { ExerciseDto } from "@pondus/shared"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { keyOf, type LibraryLookup } from "@/features/workout/selectors"
import { queryClient, queryKeys } from "@/lib/query-client"
import { useRestTimerStore } from "@/services/rest-timer-store"
import { toRestTimerSnapshot } from "@/services/rest-timer-snapshot"
import { useSettingsStore } from "@/services/settings-store"
import { activeWorkoutStorage } from "@/storage/active-workout"
import { kv } from "@/storage/db"
import { createActivityController, type ActivityController, type ActivityFactory, type DesiredActivity } from "./controller"
import { buildFinishedActivityProps, buildWorkoutActivityProps, type WorkoutActivityProps } from "./props"
import { workoutActivityLayout } from "./WorkoutActivity"

// Registers the layout with the extension on every launch, before any activity starts.
const WorkoutActivity = createLiveActivity<WorkoutActivityProps>("PondusWorkout", workoutActivityLayout)

/** Live Activities are switched off for Pondus in the iOS settings (only known after a failed start). */
export const useLiveActivityStatus = create<{ unavailable: boolean }>(() => ({ unavailable: false }))

const LINK_KEY = "live_activity"
const links = {
  load: () => kv.get<{ activityId: string; workoutKey: string }>(LINK_KEY),
  save: (link: { activityId: string; workoutKey: string }) => kv.set(LINK_KEY, link),
  clear: () => kv.delete(LINK_KEY),
}

function libraryLookup(): LibraryLookup {
  const library = queryClient.getQueryData<ExerciseDto[]>(queryKeys.exercises({ all: "true" })) ?? []
  const byId = new Map(library.map(e => [e.id, e]))
  return id => (id ? byId.get(id) : undefined)
}

/** Key of the workout shown last, to tell "completed" (summary) from "cancelled" (gone) when it disappears. */
let lastWorkoutKey: string | null = null

function desiredActivity(): DesiredActivity {
  const { workout, focusedExerciseKey } = useActiveWorkoutStore.getState()
  const settings = useSettingsStore.getState()
  if (!settings.liveActivityEnabled) return { kind: "none" }
  const now = Date.now()
  if (!workout) {
    const completed = activeWorkoutStorage.loadLastCompleted()
    const finished = completed && lastWorkoutKey !== null && keyOf(completed) === lastWorkoutKey
    lastWorkoutKey = null
    return finished ? { kind: "finished", props: buildFinishedActivityProps(completed, now) } : { kind: "none" }
  }
  lastWorkoutKey = keyOf(workout)
  const rest = toRestTimerSnapshot(useRestTimerStore.getState())
  return { kind: "active", props: buildWorkoutActivityProps({ workout, focusedExerciseKey, rest, unit: settings.weightUnit, lookup: libraryLookup(), now }) }
}

let controller: ActivityController | null = null

/** Starts mirroring the active workout into a Live Activity. Call once after the stores are hydrated. */
export function startLiveActivity() {
  if (controller) return
  const c = createActivityController({
    factory: WorkoutActivity as unknown as ActivityFactory,
    links,
    now: Date.now,
    canStart: () => AppState.currentState === "active",
    onStarted: () => useLiveActivityStatus.setState({ unavailable: false }),
    onStartFailed: () => useLiveActivityStatus.setState({ unavailable: true }),
  })
  controller = c
  const sync = () => void c.sync(desiredActivity())
  const begin = () => {
    useActiveWorkoutStore.subscribe(sync)
    useRestTimerStore.subscribe(sync)
    useSettingsStore.subscribe(sync)
    AppState.addEventListener("change", state => {
      if (state !== "active") return
      // Back in front: the activity may only start now, and a failed start may succeed after a settings change.
      c.retryStart()
      sync()
    })
    sync()
  }
  // The settings come from AsyncStorage; don't start an activity the user has switched off.
  if (useSettingsStore.persist.hasHydrated()) begin()
  else useSettingsStore.persist.onFinishHydration(begin)
}
