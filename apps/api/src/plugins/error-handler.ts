import fp from "fastify-plugin"
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "fastify-type-provider-zod"
import { AppError } from "../shared/errors.js"

export default fp(
  async app => {
    app.setErrorHandler((error: unknown, request, reply) => {
      const requestId = request.id
      const err = error as { statusCode?: unknown; message?: string }
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message, details: error.details, requestId } })
      }
      if (hasZodFastifySchemaValidationErrors(error)) {
        return reply.status(400).send({
          error: {
            code: "validation_error",
            message: "Request validation failed",
            details: error.validation.map(v => ({ path: v.instancePath, message: v.message, keyword: v.keyword })),
            requestId,
          },
        })
      }
      if (isResponseSerializationError(error)) {
        request.log.error({ err: error, requestId }, "response serialization failed")
        return reply.status(500).send({ error: { code: "serialization_error", message: "Response did not match schema", requestId } })
      }
      const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500
      if (statusCode >= 500) {
        request.log.error({ err: error, requestId }, "unhandled error")
        return reply.status(statusCode).send({ error: { code: "internal_error", message: "Internal server error", requestId } })
      }
      const code = statusCode === 429 ? "rate_limited" : statusCode === 401 ? "unauthorized" : statusCode === 404 ? "not_found" : "request_error"
      return reply.status(statusCode).send({ error: { code, message: err.message ?? "Request failed", requestId } })
    })
    app.setNotFoundHandler((request, reply) => {
      reply.status(404).send({ error: { code: "not_found", message: `Route ${request.method} ${request.url} not found`, requestId: request.id } })
    })
  },
  { name: "error-handler" },
)
