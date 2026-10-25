import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import rateLimit from "@fastify/rate-limit"
import sensible from "@fastify/sensible"
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import Fastify, { type FastifyInstance } from "fastify"
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod"
import { randomUUID } from "node:crypto"
import type { Env } from "./config/env.js"
import type { Db } from "./db/client.js"
import authPlugin from "./plugins/auth.js"
import dbPlugin from "./plugins/db.js"
import errorHandler from "./plugins/error-handler.js"
import idempotency from "./plugins/idempotency.js"
import { authRoutes } from "./modules/auth/routes.js"
import { exerciseRoutes } from "./modules/exercises/routes.js"
import { progressRoutes } from "./modules/progress/routes.js"
import { syncRoutes } from "./modules/sync/routes.js"
import { planRoutes } from "./modules/training-plans/routes.js"
import { userRoutes } from "./modules/users/routes.js"
import { workoutRoutes } from "./modules/workouts/routes.js"

export type App = FastifyInstance

export interface BuildAppOptions {
  env: Env
  /** Inject an existing db (tests). */
  db?: Db
  logger?: boolean
}

export async function buildApp(opts: BuildAppOptions): Promise<App> {
  const { env } = opts
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: env.LOG_LEVEL,
            redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.refreshToken", "*.accessToken"],
            ...(env.NODE_ENV === "development" ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
          },
    genReqId: req => (typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : randomUUID()),
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(helmet, { contentSecurityPolicy: false })
  if (env.CORS_ORIGINS.length) await app.register(cors, { origin: env.CORS_ORIGINS, credentials: true })
  await app.register(sensible)
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    keyGenerator: req => req.userId || req.ip,
  })
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Pondus API",
        description: "Backend for the Pondus strength-training app. All endpoints except auth require a Bearer access token.",
        version: "0.1.0",
      },
      servers: [{ url: "/" }],
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: "auth" },
        { name: "users" },
        { name: "exercises" },
        { name: "plans" },
        { name: "workouts" },
        { name: "progress" },
        { name: "sync" },
      ],
    },
    transform: jsonSchemaTransform,
  })
  if (env.NODE_ENV !== "production") await app.register(swaggerUi, { routePrefix: "/docs" })

  await app.register(errorHandler)
  await app.register(dbPlugin, { connectionString: env.DATABASE_URL, db: opts.db })
  await app.register(authPlugin, { accessSecret: env.JWT_ACCESS_SECRET, accessTtl: env.ACCESS_TOKEN_TTL })
  await app.register(idempotency)

  app.get("/health", { schema: { tags: ["meta"], security: [] } }, async () => ({ status: "ok", time: new Date().toISOString() }))

  await app.register(
    async api => {
      await api.register(authRoutes, { prefix: "/auth", env })
      // Everything below requires authentication.
      await api.register(async secured => {
        secured.addHook("onRequest", secured.authenticate)
        await secured.register(userRoutes, { prefix: "/me" })
        await secured.register(exerciseRoutes, { prefix: "/exercises" })
        await secured.register(planRoutes, { prefix: "/plans" })
        await secured.register(workoutRoutes, { prefix: "/workouts" })
        await secured.register(progressRoutes, { prefix: "/progress" })
        await secured.register(syncRoutes, { prefix: "/sync" })
      })
    },
    { prefix: "/api/v1" },
  )

  return app
}
