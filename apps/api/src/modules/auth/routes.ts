import { authResponse, errorResponse, loginBody, logoutBody, refreshBody, registerBody, userDto } from "@pondus/shared"
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"
import type { Env } from "../../config/env.js"
import { createAuthService, ttlToSeconds } from "./service.js"

export const authRoutes: FastifyPluginAsyncZod<{ env: Env }> = async (app, { env }) => {
  const service = createAuthService({ db: app.db, jwt: app.jwt, refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS, accessTtlSeconds: ttlToSeconds(env.ACCESS_TOKEN_TTL) })
  const strict = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }

  app.post("/register", { ...strict, schema: { tags: ["auth"], security: [], body: registerBody, response: { 201: authResponse, 409: errorResponse } } }, async (req, reply) => {
    const result = await service.register(req.body, req.headers["user-agent"])
    return reply.status(201).send(result)
  })
  app.post("/login", { ...strict, schema: { tags: ["auth"], security: [], body: loginBody, response: { 200: authResponse, 401: errorResponse } } }, async req => {
    return service.login(req.body, req.headers["user-agent"])
  })
  app.post("/refresh", { ...strict, schema: { tags: ["auth"], security: [], body: refreshBody, response: { 200: authResponse, 401: errorResponse } } }, async req => {
    return service.refresh(req.body.refreshToken, req.headers["user-agent"])
  })
  app.post("/logout", { onRequest: app.authenticate, schema: { tags: ["auth"], body: logoutBody, response: { 204: z.null() } } }, async (req, reply) => {
    await service.logout(req.userId, req.body.refreshToken)
    return reply.status(204).send(null)
  })
  app.get("/me", { onRequest: app.authenticate, schema: { tags: ["auth"], response: { 200: userDto } } }, async req => service.me(req.userId))
}
