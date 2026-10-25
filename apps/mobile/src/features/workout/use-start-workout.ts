import { useState } from "react"
import { Alert } from "react-native"
import { useRouter } from "expo-router"
import type { PlanSessionDto, WorkoutDto } from "@pondus/shared"
import { useActiveWorkoutStore } from "./active-workout-store"
import { useApi } from "@/services/session-store"
import { ApiError } from "@/lib/api-client"
import { haptic } from "@/lib/haptics"
import { errorMessage } from "@/lib/errors"

const blockingWorkoutId = (err: unknown): string | null => {
  if (!(err instanceof ApiError) || err.code !== "workout_already_active") return null
  const id = (err.details as { workoutId?: unknown } | undefined)?.workoutId
  return typeof id === "string" ? id : null
}

export function useStartWorkout() {
  const api = useApi()
  const router = useRouter()
  const store = useActiveWorkoutStore()
  const [starting, setStarting] = useState(false)
  const guard = () => {
    if (store.workout) {
      Alert.alert("Workout läuft bereits", "Beende oder brich das laufende Workout ab, bevor du ein neues startest.", [{ text: "Zum Workout", onPress: () => router.push(`/workout/${store.workout!.id}`) }, { text: "OK" }])
      return false
    }
    return true
  }
  const open = (w: WorkoutDto) => {
    haptic("medium")
    router.push(`/workout/${w.id}`)
  }
  /**
   * The server still has an open workout this phone knows nothing about (signed out mid-session,
   * other device): offer to continue it or to discard it and start the new one.
   */
  const resolveConflict = (workoutId: string, retry: () => Promise<void>) =>
    Alert.alert("Auf dem Server läuft noch ein Workout", "Du kannst es hier fortsetzen oder verwerfen und das neue starten.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Verwerfen",
        style: "destructive",
        onPress: () => {
          void store
            .discardRemote(api, workoutId)
            .then(retry)
            .catch(err => Alert.alert("Verwerfen nicht möglich", errorMessage(err)))
        },
      },
      {
        text: "Fortsetzen",
        onPress: () => {
          void store
            .takeOverRemote(api, workoutId)
            .then(open)
            .catch(err => Alert.alert("Fortsetzen nicht möglich", errorMessage(err)))
        },
      },
    ])
  const run = async (fn: () => Promise<WorkoutDto>) => {
    if (!guard()) return
    setStarting(true)
    try {
      open(await fn())
    } catch (err) {
      const blocking = blockingWorkoutId(err)
      if (blocking) resolveConflict(blocking, () => run(fn))
      else Alert.alert("Start nicht möglich", errorMessage(err, "Unbekannter Fehler"))
    } finally {
      setStarting(false)
    }
  }
  return {
    starting,
    start: (session: PlanSessionDto) => run(() => store.startFromSession(api, session, Object.fromEntries(session.exercises.map(e => [e.exerciseId, e.exerciseName])))),
    startEmpty: (name?: string) => run(() => store.startEmpty(api, name)),
    repeat: (source: WorkoutDto) => run(() => store.repeatWorkout(api, source)),
  }
}
