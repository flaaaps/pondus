import { createHash } from "node:crypto"
import { and, eq, lt } from "drizzle-orm"
import fp from "fastify-plugin"
import { idempotencyKeys } from "../db/schema.js"
import { conflict } from "../shared/errors.js"

/**
 * Optional `Idempotency-Key` header support for authenticated POST/PUT/PATCH
 * requests: the first response is stored per (user, key) and replayed for
 * retries with the same body. A retry with a different body is rejected.
 */
export default fp(
  async app => {
    app.addHook("preHandler", async (request, reply) => {
      const key = request.headers["idempotency-key"]
      if (typeof key !== "string" || !request.userId || !["POST", "PUT", "PATCH"].includes(request.method)) return
      if (key.length < 8 || key.length > 128) throw conflict("invalid_idempotency_key", "Idempotency-Key must be 8–128 characters")
      const requestHash = createHash("sha256").update(`${request.method} ${request.url}\n${JSON.stringify(request.body ?? null)}`).digest("hex")
      const [existing] = await app.db
        .select()
        .from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.userId, request.userId), eq(idempotencyKeys.key, key)))
      if (existing) {
        if (existing.requestHash !== requestHash) throw conflict("idempotency_key_reused", "Idempotency-Key was already used with a different request")
        reply.header("Idempotent-Replayed", "true")
        return reply.status(existing.responseStatus).send(existing.responseBody)
      }
      request.idempotency = { key, requestHash }
    })
    app.addHook("onSend", async (request, reply, payload) => {
      const meta = request.idempotency
      if (!meta || reply.statusCode >= 500) return payload
      let body: unknown = null
      if (typeof payload === "string" && payload.length) {
        try {
          body = JSON.parse(payload)
        } catch {
          body = payload
        }
      }
      await app.db
        .insert(idempotencyKeys)
        .values({ userId: request.userId, key: meta.key, requestHash: meta.requestHash, responseStatus: reply.statusCode, responseBody: body })
        .onConflictDoNothing()
      return payload
    })
    // Housekeeping: drop keys older than 48h once per boot.
    app.addHook("onReady", async () => {
      // Skipped when no real database is attached (e.g. OpenAPI export).
      if (typeof app.db?.delete !== "function") return
      await app.db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, new Date(Date.now() - 48 * 3600 * 1000)))
    })
  },
  { name: "idempotency", dependencies: ["db", "auth"] },
)

declare module "fastify" {
  interface FastifyRequest {
    idempotency?: { key: string; requestHash: string }
  }
}
