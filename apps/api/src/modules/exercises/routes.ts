import { alternativeDto, createCustomExerciseBody, exerciseDto, exerciseHistoryQuery, exerciseListQuery, paginated, setType, updateCustomExerciseBody } from "@pondus/shared"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"
import { createExercisesService } from "./service.js"

const idParams = z.object({ id: z.uuid() })

export const exerciseRoutes: FastifyPluginAsyncZod = async app => {
  const service = createExercisesService(app.db)
  app.get("/", { schema: { tags: ["exercises"], querystring: exerciseListQuery, response: { 200: paginated(exerciseDto).extend({ total: z.number().int() }) } } }, async req =>
    service.list(req.userId, req.query),
  )
  app.get(
    "/muscle-groups",
    { schema: { tags: ["exercises"], response: { 200: z.array(z.object({ id: z.uuid(), slug: z.string(), nameDe: z.string(), nameEn: z.string(), region: z.string(), displayOrder: z.number().int() })) } } },
    async () => service.muscleGroups(),
  )
  app.post("/", { schema: { tags: ["exercises"], body: createCustomExerciseBody, response: { 201: exerciseDto } } }, async (req, reply) =>
    reply.status(201).send(await service.createCustom(req.userId, req.body)),
  )
  app.get("/:id", { schema: { tags: ["exercises"], params: idParams, response: { 200: exerciseDto } } }, async req => service.get(req.userId, req.params.id))
  app.patch("/:id", { schema: { tags: ["exercises"], params: idParams, body: updateCustomExerciseBody, response: { 200: exerciseDto } } }, async req =>
    service.updateCustom(req.userId, req.params.id, req.body),
  )
  app.delete("/:id", { schema: { tags: ["exercises"], params: idParams, response: { 204: z.null() } } }, async (req, reply) => {
    await service.deleteCustom(req.userId, req.params.id)
    return reply.status(204).send(null)
  })
  app.get("/:id/alternatives", { schema: { tags: ["exercises"], params: idParams, response: { 200: z.array(alternativeDto) } } }, async req =>
    service.alternatives(req.userId, req.params.id),
  )
  app.put("/:id/favorite", { schema: { tags: ["exercises"], params: idParams, response: { 200: exerciseDto } } }, async req => service.setFavorite(req.userId, req.params.id, true))
  app.delete("/:id/favorite", { schema: { tags: ["exercises"], params: idParams, response: { 200: exerciseDto } } }, async req => service.setFavorite(req.userId, req.params.id, false))
  app.get(
    "/:id/history",
    {
      schema: {
        tags: ["exercises"],
        params: idParams,
        querystring: exerciseHistoryQuery,
        response: {
          200: paginated(
            z.object({
              workoutId: z.uuid(),
              workoutName: z.string(),
              completedAt: z.string(),
              sets: z.array(z.object({ setNumber: z.number().int(), setType, weightGrams: z.number().int().nullable(), reps: z.number().int().nullable(), rir: z.number().int().nullable(), rpe: z.number().nullable(), completed: z.boolean() })),
            }),
          ),
        },
      },
    },
    async req => service.history(req.userId, req.params.id, req.query),
  )
}
