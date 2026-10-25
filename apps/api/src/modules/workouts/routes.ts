import { addWorkoutExerciseBody, completeWorkoutBody, paginated, pauseResumeBody, startWorkoutBody, updateWorkoutBody, updateWorkoutExerciseBody, upsertSetBody, workoutDto, workoutHistoryQuery, workoutStatus, workoutSummaryDto } from "@pondus/shared"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"
import { createWorkoutsService } from "./service.js"

const idParams = z.object({ id: z.uuid() })
export const workoutHistoryItem = z.object({
  id: z.uuid(),
  name: z.string(),
  status: workoutStatus,
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  durationSeconds: z.number().int().nullable(),
  workingSets: z.number().int(),
  tonnageGrams: z.number().int(),
  exerciseCount: z.number().int(),
  sourceSessionId: z.uuid().nullable(),
})

export const workoutRoutes: FastifyPluginAsyncZod = async app => {
  const service = createWorkoutsService(app.db)
  app.get("/", { schema: { tags: ["workouts"], querystring: workoutHistoryQuery, response: { 200: paginated(workoutHistoryItem) } } }, async req => service.history(req.userId, req.query))
  app.get("/active", { schema: { tags: ["workouts"], response: { 200: workoutDto.nullable() } } }, async req => service.active(req.userId))
  app.post("/", { schema: { tags: ["workouts"], body: startWorkoutBody, response: { 200: workoutDto, 201: workoutDto } } }, async (req, reply) => {
    const { workout, created } = await service.start(req.userId, req.body)
    return reply.status(created ? 201 : 200).send(workout)
  })
  app.get("/:id", { schema: { tags: ["workouts"], params: idParams, response: { 200: workoutDto } } }, async req => service.get(req.userId, req.params.id))
  app.patch("/:id", { schema: { tags: ["workouts"], params: idParams, body: updateWorkoutBody, response: { 200: workoutDto } } }, async req => service.update(req.userId, req.params.id, req.body))
  app.post("/:id/exercises", { schema: { tags: ["workouts"], params: idParams, body: addWorkoutExerciseBody, response: { 200: workoutDto } } }, async req => service.addExercise(req.userId, req.params.id, req.body))
  app.patch("/:id/exercises/:exerciseId", { schema: { tags: ["workouts"], params: idParams.extend({ exerciseId: z.uuid() }), body: updateWorkoutExerciseBody, response: { 200: workoutDto } } }, async req =>
    service.updateExercise(req.userId, req.params.id, req.params.exerciseId, req.body),
  )
  app.put("/:id/exercises/:exerciseId/sets", { schema: { tags: ["workouts"], params: idParams.extend({ exerciseId: z.uuid() }), body: upsertSetBody, response: { 200: workoutDto } } }, async req => {
    const { workout } = await service.upsertSet(req.userId, req.params.id, req.params.exerciseId, req.body)
    return workout
  })
  app.delete("/:id/sets/:setId", { schema: { tags: ["workouts"], params: idParams.extend({ setId: z.string().min(1) }), response: { 200: workoutDto } } }, async req => service.deleteSet(req.userId, req.params.id, req.params.setId))
  app.post("/:id/pause", { schema: { tags: ["workouts"], params: idParams, body: pauseResumeBody, response: { 200: workoutDto } } }, async req => service.pause(req.userId, req.params.id, req.body.at))
  app.post("/:id/resume", { schema: { tags: ["workouts"], params: idParams, body: pauseResumeBody, response: { 200: workoutDto } } }, async req => service.resume(req.userId, req.params.id, req.body.at))
  app.post("/:id/complete", { schema: { tags: ["workouts"], params: idParams, body: completeWorkoutBody, response: { 200: workoutSummaryDto } } }, async req => service.complete(req.userId, req.params.id, req.body))
  app.post("/:id/cancel", { schema: { tags: ["workouts"], params: idParams, response: { 200: workoutDto } } }, async req => service.cancel(req.userId, req.params.id))
  app.get("/:id/summary", { schema: { tags: ["workouts"], params: idParams, response: { 200: workoutSummaryDto } } }, async req => service.summary(req.userId, req.params.id))
}
