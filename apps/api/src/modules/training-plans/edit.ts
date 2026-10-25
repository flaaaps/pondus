import type { PlanEditOp, PlanVersionDto, PlanSessionDto, PlanExerciseDto, ExerciseRef } from "@pondus/shared"
import { prescriptionForExercise, type ExperienceLevel, type Goal } from "@pondus/shared"
import { badRequest, notFound } from "../../shared/errors.js"

/**
 * Apply edit operations to an in-memory copy of a version. Pure: returns the
 * edited version and the (possibly renamed) plan name. The caller persists the
 * result as a new version so history stays intact.
 */
export function applyEditOps(
  version: PlanVersionDto,
  planName: string,
  ops: PlanEditOp[],
  exercisesById: Map<string, ExerciseRef>,
  goal: Goal,
  experience: ExperienceLevel,
): { version: PlanVersionDto; planName: string } {
  const v: PlanVersionDto = structuredClone(version)
  let name = planName
  const findSession = (id: string): PlanSessionDto => {
    const s = v.sessions.find(x => x.id === id)
    if (!s) throw notFound("Plan session")
    return s
  }
  const findExercise = (id: string): { session: PlanSessionDto; exercise: PlanExerciseDto; index: number } => {
    for (const session of v.sessions) {
      const index = session.exercises.findIndex(e => e.id === id)
      if (index >= 0) return { session, exercise: session.exercises[index]!, index }
    }
    throw notFound("Plan exercise")
  }
  const requireExercise = (id: string): ExerciseRef => {
    const ref = exercisesById.get(id)
    if (!ref) throw badRequest("unknown_exercise", "Exercise does not exist or is not visible to you")
    return ref
  }
  const defaultsFor = (ref: ExerciseRef) => prescriptionForExercise(ref, goal, experience)
  const tmpId = () => `new-${Math.random().toString(36).slice(2)}`

  for (const op of ops) {
    switch (op.op) {
      case "rename_plan":
        name = op.name
        break
      case "rename_session":
        findSession(op.sessionId).name = op.name
        break
      case "move_session":
        findSession(op.sessionId).weekday = op.weekday
        break
      case "reorder_sessions": {
        const order = new Map(op.sessionIds.map((id, i) => [id, i]))
        v.sessions.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
        break
      }
      case "add_session":
        v.sessions.push({ id: tmpId(), name: op.name, sequence: v.sessions.length + 1, weekday: op.weekday, focusMuscles: [], estimatedDurationMinutes: 0, exercises: [] })
        break
      case "remove_session": {
        const idx = v.sessions.findIndex(s => s.id === op.sessionId)
        if (idx < 0) throw notFound("Plan session")
        if (v.sessions.length === 1) throw badRequest("last_session", "A plan needs at least one session")
        v.sessions.splice(idx, 1)
        break
      }
      case "add_exercise": {
        const session = findSession(op.sessionId)
        const ref = requireExercise(op.exerciseId)
        const d = defaultsFor(ref)
        session.exercises.push({
          id: tmpId(),
          exerciseId: ref.id,
          exerciseName: ref.nameDe,
          sequence: session.exercises.length + 1,
          targetSets: op.params?.targetSets ?? 3,
          targetRepsMin: op.params?.targetRepsMin ?? d.repsMin,
          targetRepsMax: op.params?.targetRepsMax ?? d.repsMax,
          restSeconds: op.params?.restSeconds ?? d.restSeconds,
          targetRir: op.params?.targetRir === undefined ? d.rir : op.params.targetRir,
          warmupSets: op.params?.warmupSets ?? 0,
          notes: op.params?.notes ?? null,
        })
        break
      }
      case "remove_exercise": {
        const { session, index } = findExercise(op.planExerciseId)
        session.exercises.splice(index, 1)
        break
      }
      case "duplicate_exercise": {
        const { session, exercise, index } = findExercise(op.planExerciseId)
        session.exercises.splice(index + 1, 0, { ...exercise, id: tmpId() })
        break
      }
      case "swap_exercise": {
        const { exercise } = findExercise(op.planExerciseId)
        const ref = requireExercise(op.newExerciseId)
        exercise.exerciseId = ref.id
        exercise.exerciseName = ref.nameDe
        break
      }
      case "update_exercise": {
        const { exercise } = findExercise(op.planExerciseId)
        Object.assign(exercise, stripUndefined(op.params))
        if (exercise.targetRepsMin > exercise.targetRepsMax) throw badRequest("invalid_rep_range", "Minimum reps must not exceed maximum reps")
        break
      }
      case "reorder_exercises": {
        const session = findSession(op.sessionId)
        const order = new Map(op.planExerciseIds.map((id, i) => [id, i]))
        session.exercises.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
        break
      }
    }
  }
  v.sessions.forEach((s, i) => {
    s.sequence = i + 1
    s.exercises.forEach((e, j) => (e.sequence = j + 1))
  })
  return { version: v, planName: name }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
