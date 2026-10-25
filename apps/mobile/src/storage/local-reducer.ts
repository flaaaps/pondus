import type { SyncMutation, WorkoutDto, WorkoutExerciseDto, WorkoutSetDto } from "@pondus/shared"

/**
 * Pure, synchronous mirror of the server's workout mutations. The UI updates
 * from this immediately; the server applies the same mutation later via the
 * outbox. Keeping both in lock-step is what makes offline logging feel instant.
 */
export function applyLocalMutation(workout: WorkoutDto | null, m: SyncMutation, now: string = new Date().toISOString()): WorkoutDto | null {
  if (m.kind === "start_workout") return workout // creation is handled by the store (needs plan data)
  if (!workout) return null
  const touch = (w: WorkoutDto): WorkoutDto => ({ ...w, updatedAt: now })
  switch (m.kind) {
    case "add_exercise": {
      if (workout.exercises.some(e => e.clientId === m.body.clientId)) return workout
      const seq = m.body.sequence ?? workout.exercises.length + 1
      const exercise: WorkoutExerciseDto = {
        id: m.body.clientId,
        clientId: m.body.clientId,
        exerciseId: m.body.exerciseId,
        exerciseNameSnapshot: (m as { exerciseName?: string }).exerciseName ?? "Übung",
        sequence: seq,
        targetSets: m.body.targetSets ?? 3,
        targetRepsMin: m.body.targetRepsMin ?? null,
        targetRepsMax: m.body.targetRepsMax ?? null,
        restSeconds: m.body.restSeconds ?? 120,
        targetRir: m.body.targetRir ?? null,
        skipped: false,
        notes: null,
        replacesWorkoutExerciseId: m.body.replacesWorkoutExerciseId ?? null,
        sets: [],
        previous: null,
      }
      let exercises = workout.exercises
      if (m.body.replacesWorkoutExerciseId) {
        exercises = exercises.map(e => (e.id === m.body.replacesWorkoutExerciseId || e.clientId === m.body.replacesWorkoutExerciseId ? { ...e, skipped: true } : e))
      }
      const list = [...exercises.filter(e => e.sequence < seq), exercise, ...exercises.filter(e => e.sequence >= seq).map(e => ({ ...e, sequence: e.sequence + 1 }))]
      return touch({ ...workout, exercises: list })
    }
    case "remove_exercise": {
      const gone = workout.exercises.find(e => matches(e, m.exerciseClientId))
      if (!gone) return workout
      const rest = workout.exercises.filter(e => e !== gone).map(e => ({ ...e, sequence: e.sequence > gone.sequence ? e.sequence - 1 : e.sequence }))
      // A stand-in that pointed at the removed exercise loses its link, like on the server.
      return touch({ ...workout, exercises: rest.map(e => (e.replacesWorkoutExerciseId && matches(gone, e.replacesWorkoutExerciseId) ? { ...e, replacesWorkoutExerciseId: null } : e)) })
    }
    case "update_exercise":
      return touch({
        ...workout,
        exercises: workout.exercises.map(e => (matches(e, m.exerciseClientId) ? { ...e, ...stripUndefined(m.body) } : e)),
      })
    case "upsert_set":
      return touch({
        ...workout,
        exercises: workout.exercises.map(e => {
          if (!matches(e, m.exerciseClientId)) return e
          const existing = e.sets.find(s => s.clientId === m.body.clientId)
          const set: WorkoutSetDto = {
            id: existing?.id ?? m.body.clientId,
            clientId: m.body.clientId,
            setNumber: m.body.setNumber,
            setType: m.body.setType,
            weightGrams: m.body.weightGrams,
            reps: m.body.reps,
            rir: m.body.rir,
            rpe: m.body.rpe,
            completed: m.body.completed,
            completedAt: m.body.completedAt ?? (m.body.completed ? now : null),
            notes: m.body.notes,
            targetWeightGrams: existing?.targetWeightGrams ?? null,
            targetReps: existing?.targetReps ?? null,
          }
          const sets = existing ? e.sets.map(s => (s.clientId === m.body.clientId ? set : s)) : [...e.sets, set]
          return { ...e, sets: sets.sort((a, b) => a.setNumber - b.setNumber) }
        }),
      })
    case "delete_set":
      return touch({
        ...workout,
        exercises: workout.exercises.map(e => ({ ...e, sets: renumber(e.sets.filter(s => s.clientId !== m.setClientId && s.id !== m.setClientId)) })),
      })
    case "pause":
      if (workout.status !== "in_progress") return workout
      return touch({ ...workout, status: "paused", pausedAt: m.body.at ?? now })
    case "resume": {
      if (workout.status !== "paused" || !workout.pausedAt) return workout
      const at = m.body.at ?? now
      const extra = Math.max(0, Math.round((new Date(at).getTime() - new Date(workout.pausedAt).getTime()) / 1000))
      return touch({ ...workout, status: "in_progress", pausedAt: null, pausedSeconds: workout.pausedSeconds + extra })
    }
    case "complete": {
      const completedAt = m.body.completedAt ?? now
      let paused = workout.pausedSeconds
      if (workout.status === "paused" && workout.pausedAt) paused += Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(workout.pausedAt).getTime()) / 1000))
      const duration = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(workout.startedAt).getTime()) / 1000) - paused)
      return touch({
        ...workout,
        status: "completed",
        completedAt,
        pausedAt: null,
        pausedSeconds: paused,
        durationSeconds: duration,
        notes: m.body.notes === undefined ? workout.notes : m.body.notes,
        exercises: workout.exercises.map(e => ({ ...e, sets: e.sets.filter(s => s.completed) })),
      })
    }
    case "cancel":
      return touch({ ...workout, status: "cancelled" })
  }
}

const matches = (e: WorkoutExerciseDto, ref: string) => e.id === ref || e.clientId === ref
const renumber = (sets: WorkoutSetDto[]) => sets.map((s, i) => ({ ...s, setNumber: i + 1 }))
function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

/** Live elapsed seconds excluding pauses. */
export function elapsedSeconds(w: WorkoutDto, now = Date.now()): number {
  const started = new Date(w.startedAt).getTime()
  let paused = w.pausedSeconds
  if (w.status === "paused" && w.pausedAt) paused += Math.max(0, (now - new Date(w.pausedAt).getTime()) / 1000)
  return Math.max(0, Math.round((now - started) / 1000 - paused))
}

/**
 * The server copy is authoritative for everything it knows, but values typed
 * into not-yet-completed sets only live locally until the set is ticked off.
 * Carry those drafts over when adopting the server copy, so a sync never
 * wipes what the user just entered.
 */
export function mergeLocalDrafts(server: WorkoutDto, local: WorkoutDto | null): WorkoutDto {
  if (!local) return server
  const key = (x: { id: string; clientId?: string | null }) => x.clientId ?? x.id
  return {
    ...server,
    exercises: server.exercises.map(se => {
      const le = local.exercises.find(e => key(e) === key(se) || e.id === se.id)
      if (!le) return se
      const sets = se.sets.map(s => ({ ...s }))
      for (const ls of le.sets) {
        if (ls.completed) continue
        const target = sets.find(s => key(s) === key(ls) || s.id === ls.id) ?? sets.find(s => s.setNumber === ls.setNumber && !s.completed)
        if (target) {
          if (target.completed) continue
          Object.assign(target, { setType: ls.setType, weightGrams: ls.weightGrams, reps: ls.reps, rir: ls.rir, targetWeightGrams: target.targetWeightGrams ?? ls.targetWeightGrams, targetReps: target.targetReps ?? ls.targetReps })
        } else if (!sets.some(s => s.setNumber === ls.setNumber)) sets.push({ ...ls })
      }
      return { ...se, sets: sets.sort((a, b) => a.setNumber - b.setNumber) }
    }),
  }
}
