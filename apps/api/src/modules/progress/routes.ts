import { exerciseProgressDto, paginated, paginationQuery, personalRecordDto, progressOverviewDto, rangeQuery } from "@pondus/shared"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"
import { createProgressService } from "./service.js"

export const progressRoutes: FastifyPluginAsyncZod = async app => {
  const service = createProgressService(app.db)
  app.get("/overview", { schema: { tags: ["progress"], querystring: rangeQuery.extend({ timeZone: z.string().max(64).optional() }), response: { 200: progressOverviewDto } } }, async req =>
    service.overview(req.userId, req.query.range, req.query.timeZone),
  )
  app.get("/exercises/:id", { schema: { tags: ["progress"], params: z.object({ id: z.uuid() }), querystring: rangeQuery, response: { 200: exerciseProgressDto } } }, async req =>
    service.exercise(req.userId, req.params.id, req.query.range),
  )
  app.get("/records", { schema: { tags: ["progress"], querystring: paginationQuery.extend({ exerciseId: z.uuid().optional() }), response: { 200: paginated(personalRecordDto) } } }, async req =>
    service.records(req.userId, req.query),
  )
}
