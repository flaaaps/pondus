import { adjustmentPreviewDto, applyPreviewBody, editPlanBody, generatePlanBody, planDto, planSessionDto, planSummaryDto, planVersionDto, planWeekDto, previewAdjustmentBody, sessionOverrideBody, weekQuery } from "@pondus/shared"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"
import { createPlansService } from "./service.js"

const idParams = z.object({ id: z.uuid() })

export const planRoutes: FastifyPluginAsyncZod = async app => {
  const service = createPlansService(app.db)
  app.get("/", { schema: { tags: ["plans"], response: { 200: z.array(planSummaryDto) } } }, async req => service.list(req.userId))
  app.get("/active", { schema: { tags: ["plans"], response: { 200: planDto.nullable() } } }, async req => service.getActive(req.userId))
  app.get("/week", { schema: { tags: ["plans"], querystring: weekQuery, response: { 200: planWeekDto } } }, async req => service.week(req.userId, req.query.date, req.query.timeZone))
  app.post("/generate", { schema: { tags: ["plans"], body: generatePlanBody, response: { 201: planDto } } }, async (req, reply) => reply.status(201).send(await service.generate(req.userId, req.body)))
  app.get("/sessions/:id", { schema: { tags: ["plans"], params: idParams, response: { 200: z.object({ planId: z.uuid(), planName: z.string(), versionNumber: z.number().int(), session: planSessionDto }) } } }, async req =>
    service.sessionDetail(req.userId, req.params.id),
  )
  app.post("/sessions/:id/override", { schema: { tags: ["plans"], params: idParams, body: sessionOverrideBody, response: { 200: planWeekDto } } }, async req =>
    service.overrideSession(req.userId, req.params.id, req.body),
  )
  app.get("/:id", { schema: { tags: ["plans"], params: idParams, response: { 200: planDto } } }, async req => service.get(req.userId, req.params.id))
  app.get("/:id/versions/:version", { schema: { tags: ["plans"], params: idParams.extend({ version: z.coerce.number().int().min(1) }), response: { 200: planVersionDto } } }, async req =>
    service.getVersion(req.userId, req.params.id, req.params.version),
  )
  app.post("/:id/activate", { schema: { tags: ["plans"], params: idParams, response: { 200: planDto } } }, async req => service.activate(req.userId, req.params.id))
  app.post("/:id/archive", { schema: { tags: ["plans"], params: idParams, response: { 200: planDto } } }, async req => service.archive(req.userId, req.params.id))
  app.post("/:id/edit", { schema: { tags: ["plans"], params: idParams, body: editPlanBody, response: { 200: planDto } } }, async req => service.edit(req.userId, req.params.id, req.body.ops))
  app.post("/:id/adjustments/preview", { schema: { tags: ["plans"], params: idParams, body: previewAdjustmentBody, response: { 200: adjustmentPreviewDto } } }, async req =>
    service.previewAdjustment(req.userId, req.params.id, req.body),
  )
  app.post("/:id/adjustments/apply", { schema: { tags: ["plans"], params: idParams, body: applyPreviewBody, response: { 200: planDto } } }, async req =>
    service.applyPreview(req.userId, req.params.id, req.body.previewId),
  )
  app.delete("/:id/adjustments/:previewId", { schema: { tags: ["plans"], params: idParams.extend({ previewId: z.uuid() }), response: { 204: z.null() } } }, async (req, reply) => {
    await service.discardPreview(req.userId, req.params.id, req.params.previewId)
    return reply.status(204).send(null)
  })
}
