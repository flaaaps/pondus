import { useState } from "react"
import { Alert } from "react-native"
import { useRouter } from "expo-router"
import type { PlanSessionDto, WorkoutDto } from "@pondus/shared"
import { useActiveWorkoutStore } from "./active-workout-store"
import { useApi } from "@/services/session-store"
import { haptic } from "@/lib/haptics"
import { errorMessage } from "@/lib/errors"

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
  const run = async (fn: () => Promise<WorkoutDto>) => {
    if (!guard()) return
    setStarting(true)
    try {
      const w = await fn()
      haptic("medium")
      router.push(`/workout/${w.id}`)
    } catch (err) {
      Alert.alert("Start nicht möglich", errorMessage(err, "Unbekannter Fehler"))
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
