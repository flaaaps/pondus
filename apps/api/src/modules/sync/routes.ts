import { syncBody, syncResultDto, type SyncMutation, type WorkoutDto } from "@pondus/shared"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { AppError } from "../../shared/errors.js"
import { createWorkoutsService } from "../workouts/service.js"

/**
 * Offline replay: the app queues workout mutations while offline and sends
 * them in order. Every mutation is idempotent (client ids), so a batch can be
 * retried safely. Results are reported per mutation; the batch never aborts
 * halfway because later mutations may still be valid.
 */
export const syncRoutes: FastifyPluginAsyncZod = async app => {
  const workoutsService = createWorkoutsService(app.db)

  app.post("/workouts", { schema: { tags: ["sync"], body: syncBody, response: { 200: syncResultDto } } }, async req => {
    const userId = req.userId
    const results: { index: number; status: "applied" | "duplicate" | "conflict" | "error"; message?: string }[] = []
    const touched = new Map<string, WorkoutDto>()
    const resolveWorkout = async (clientId: string) => {
      const w = await workoutsService.byClientId(userId, clientId)
      if (!w) throw new AppError(404, "unknown_workout", `No workout with client id ${clientId}`)
      return w
    }
    const resolveExercise = (w: WorkoutDto, exerciseClientId: string) => {
      const e = w.exercises.find(x => x.clientId === exerciseClientId || x.id === exerciseClientId)
      if (!e) throw new AppError(404, "unknown_workout_exercise", `No exercise with client id ${exerciseClientId}`)
      return e
    }

    for (const [index, m] of req.body.mutations.entries()) {
      try {
        const outcome = await apply(m)
        results.push({ index, status: outcome.status })
        if (outcome.workout) touched.set(outcome.workout.id, outcome.workout)
      } catch (err) {
        if (err instanceof AppError) results.push({ index, status: err.statusCode === 409 ? "conflict" : "error", message: err.message })
        else {
          req.log.error({ err, index }, "sync mutation failed")
          results.push({ index, status: "error", message: "Internal error" })
        }
      }
    }
    return { applied: results.filter(r => r.status === "applied").length, results, workouts: [...touched.values()] }

    async function apply(m: SyncMutation): Promise<{ status: "applied" | "duplicate"; workout: WorkoutDto | null }> {
      switch (m.kind) {
        case "start_workout": {
          const { workout, created } = await workoutsService.start(userId, m.body)
          return { status: created ? "applied" : "duplicate", workout }
        }
        case "add_exercise": {
          const w = await resolveWorkout(m.workoutClientId)
          const before = await workoutsService.toDto(w)
          const dup = before.exercises.some(e => e.clientId === m.body.clientId)
          const workout = dup ? before : await workoutsService.addExercise(userId, w.id, m.body)
          return { status: dup ? "duplicate" : "applied", workout }
        }
        case "update_exercise": {
          const w = await resolveWorkout(m.workoutClientId)
          const e = resolveExercise(await workoutsService.toDto(w), m.exerciseClientId)
          return { status: "applied", workout: await workoutsService.updateExercise(userId, w.id, e.id, m.body) }
        }
        case "upsert_set": {
          const w = await resolveWorkout(m.workoutClientId)
          const e = resolveExercise(await workoutsService.toDto(w), m.exerciseClientId)
          const { workout, applied } = await workoutsService.upsertSet(userId, w.id, e.id, m.body)
          return { status: applied ? "applied" : "duplicate", workout }
        }
        case "delete_set": {
          const w = await resolveWorkout(m.workoutClientId)
          return { status: "applied", workout: await workoutsService.deleteSet(userId, w.id, m.setClientId) }
        }
        case "pause": {
          const w = await resolveWorkout(m.workoutClientId)
          return { status: "applied", workout: await workoutsService.pause(userId, w.id, m.body.at) }
        }
        case "resume": {
          const w = await resolveWorkout(m.workoutClientId)
          return { status: "applied", workout: await workoutsService.resume(userId, w.id, m.body.at) }
        }
        case "complete": {
          const w = await resolveWorkout(m.workoutClientId)
          if (w.status === "completed") return { status: "duplicate", workout: await workoutsService.toDto(w) }
          const summary = await workoutsService.complete(userId, w.id, m.body)
          return { status: "applied", workout: summary.workout }
        }
        case "cancel": {
          const w = await resolveWorkout(m.workoutClientId)
          if (w.status === "cancelled") return { status: "duplicate", workout: await workoutsService.toDto(w) }
          return { status: "applied", workout: await workoutsService.cancel(userId, w.id) }
        }
      }
    }
  })
}
