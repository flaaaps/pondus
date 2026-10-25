import fastifyJwt from "@fastify/jwt"
import fp from "fastify-plugin"
import type { FastifyReply, FastifyRequest } from "fastify"
import { unauthorized } from "../shared/errors.js"

export interface AccessTokenPayload {
  sub: string
  type: "access"
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AccessTokenPayload
    user: AccessTokenPayload
  }
}
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    userId: string
  }
}

export default fp(
  async (app, opts: { accessSecret: string; accessTtl: string }) => {
    await app.register(fastifyJwt, { secret: opts.accessSecret, sign: { expiresIn: opts.accessTtl } })
    app.decorateRequest("userId", "")
    app.decorate("authenticate", async (request: FastifyRequest) => {
      try {
        const payload = await request.jwtVerify<AccessTokenPayload>()
        if (payload.type !== "access") throw unauthorized("Invalid token type")
        request.userId = payload.sub
      } catch (err) {
        if (err instanceof Error && "statusCode" in err && (err as { statusCode: number }).statusCode === 401) throw unauthorized("Invalid or expired token")
        throw err
      }
    })
  },
  { name: "auth" },
)
