import {
  exercisePreferencesDto,
  trainingProfileDto,
  updateExercisePreferencesBody,
  updateMusclePrioritiesBody,
  updateTrainingProfileBody,
  updateUserBody,
  userDto,
} from "@pondus/shared"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"
import { createUsersService } from "./service.js"

export const userRoutes: FastifyPluginAsyncZod = async app => {
  const service = createUsersService(app.db)
  app.patch("/", { schema: { tags: ["users"], body: updateUserBody, response: { 200: userDto } } }, async req => service.updateUser(req.userId, req.body))
  app.get("/profile", { schema: { tags: ["users"], response: { 200: trainingProfileDto } } }, async req => service.getProfile(req.userId))
  app.put("/profile", { schema: { tags: ["users"], body: updateTrainingProfileBody, response: { 200: trainingProfileDto } } }, async req =>
    service.updateProfile(req.userId, req.body),
  )
  app.put("/profile/muscle-priorities", { schema: { tags: ["users"], body: updateMusclePrioritiesBody, response: { 200: trainingProfileDto } } }, async req =>
    service.updatePriorities(req.userId, req.body.priorities),
  )
  app.get("/exercise-preferences", { schema: { tags: ["users"], response: { 200: exercisePreferencesDto } } }, async req => service.getExercisePreferences(req.userId))
  app.put("/exercise-preferences", { schema: { tags: ["users"], body: updateExercisePreferencesBody, response: { 200: exercisePreferencesDto } } }, async req =>
    service.updateExercisePreferences(req.userId, req.body),
  )
  app.get("/export", { schema: { tags: ["users"], response: { 200: z.record(z.string(), z.unknown()) } } }, async req => service.exportData(req.userId))
  app.delete("/", { schema: { tags: ["users"], response: { 204: z.null() } } }, async (req, reply) => {
    await service.deleteAccount(req.userId)
    return reply.status(204).send(null)
  })
}
