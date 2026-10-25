import { hash, verify } from "@node-rs/argon2"
import { and, eq, isNull, sql } from "drizzle-orm"
import { createHash, randomBytes } from "node:crypto"
import type { FastifyInstance } from "fastify"
import type { Db } from "../../db/client.js"
import { refreshTokens, userTrainingProfiles, users } from "../../db/schema.js"
import { AppError, unauthorized } from "../../shared/errors.js"
import { toIso } from "../../shared/time.js"

export interface AuthDeps {
  db: Db
  jwt: FastifyInstance["jwt"]
  refreshTtlDays: number
  accessTtlSeconds: number
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

export function toUserDto(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt.toISOString(),
    onboardingCompletedAt: toIso(u.onboardingCompletedAt),
    weightUnit: u.weightUnit,
    locale: u.locale,
  }
}

export function createAuthService(deps: AuthDeps) {
  async function issueTokens(userId: string, userAgent: string | undefined) {
    const accessToken = await deps.jwt.sign({ sub: userId, type: "access" })
    const refreshToken = randomBytes(48).toString("base64url")
    const refreshExpires = new Date(Date.now() + deps.refreshTtlDays * 86400 * 1000)
    await deps.db.insert(refreshTokens).values({ userId, tokenHash: hashToken(refreshToken), expiresAt: refreshExpires, userAgent: userAgent?.slice(0, 200) ?? null })
    return {
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + deps.accessTtlSeconds * 1000).toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpires.toISOString(),
    }
  }

  return {
    async register(input: { email: string; password: string; displayName: string }, userAgent?: string) {
      const [existing] = await deps.db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${input.email}`)
      if (existing) throw new AppError(409, "email_taken", "An account with this email already exists")
      const passwordHash = await hash(input.password)
      const user = await deps.db.transaction(async tx => {
        const [u] = await tx.insert(users).values({ email: input.email, passwordHash, displayName: input.displayName }).returning()
        if (!u) throw new Error("insert failed")
        await tx.insert(userTrainingProfiles).values({ userId: u.id })
        return u
      })
      return { user: toUserDto(user), tokens: await issueTokens(user.id, userAgent) }
    },

    async login(input: { email: string; password: string }, userAgent?: string) {
      const [user] = await deps.db.select().from(users).where(and(sql`lower(${users.email}) = ${input.email}`, isNull(users.deletedAt)))
      // Constant-ish time: verify against a dummy hash when the user does not exist.
      const ok = user ? await verify(user.passwordHash, input.password) : (await hash("dummy-password-for-timing"), false)
      if (!user || !ok) throw unauthorized("Invalid email or password")
      return { user: toUserDto(user), tokens: await issueTokens(user.id, userAgent) }
    },

    async refresh(refreshToken: string, userAgent?: string) {
      const tokenHash = hashToken(refreshToken)
      const [row] = await deps.db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash))
      if (!row || row.revokedAt || row.expiresAt < new Date()) throw unauthorized("Refresh token is invalid or expired")
      const [user] = await deps.db.select().from(users).where(and(eq(users.id, row.userId), isNull(users.deletedAt)))
      if (!user) throw unauthorized("Account no longer exists")
      // Rotate: revoke the old token, issue a new pair.
      await deps.db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id))
      return { user: toUserDto(user), tokens: await issueTokens(user.id, userAgent) }
    },

    async logout(userId: string, refreshToken?: string) {
      if (refreshToken) {
        await deps.db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.tokenHash, hashToken(refreshToken)), eq(refreshTokens.userId, userId)))
      } else {
        await deps.db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
      }
    },

    async me(userId: string) {
      const [user] = await deps.db.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt)))
      if (!user) throw unauthorized("Account no longer exists")
      return toUserDto(user)
    },
  }
}

export function ttlToSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl)
  if (!m) return 900
  const n = Number(m[1])
  return n * ({ s: 1, m: 60, h: 3600, d: 86400 } as Record<string, number>)[m[2]!]!
}
