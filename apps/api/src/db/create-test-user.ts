/**
 * Creates (or resets the password of) a local test user. Development only.
 * Usage: DATABASE_URL=... pnpm db:create-test-user [email] [password]
 */
import { hash } from "@node-rs/argon2"
import { eq, sql } from "drizzle-orm"
import { createDb } from "./client.js"
import { userTrainingProfiles, users } from "./schema.js"

if (process.env.NODE_ENV === "production") throw new Error("Refusing to create a test user in production")
const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is required")
const email = (process.argv[2] ?? "test@pondus.local").toLowerCase()
const password = process.argv[3] ?? "pondus-test-1234"
const { db, pool } = createDb(url, { max: 1 })
try {
  const passwordHash = await hash(password)
  const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`)
  let userId: string
  if (existing) {
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, existing.id))
    userId = existing.id
  } else {
    const [user] = await db.insert(users).values({ email, passwordHash, displayName: "Test" }).returning()
    if (!user) throw new Error("insert failed")
    userId = user.id
  }
  await db.insert(userTrainingProfiles).values({ userId }).onConflictDoNothing()
  console.log(`Test user ready: ${email} (id ${userId}). Password: ${password}`)
} finally {
  await pool.end()
}
