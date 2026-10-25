import { useEffect, useState } from "react"
import type { WorkoutDto } from "@pondus/shared"
import { elapsedSeconds } from "@/storage/local-reducer"

export function useElapsed(workout: WorkoutDto | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!workout || workout.status === "completed") return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [workout])
  return workout ? elapsedSeconds(workout, now) : 0
}
