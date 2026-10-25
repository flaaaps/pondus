import { migrate } from "drizzle-orm/node-postgres/migrator"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createDb } from "./client.js"

export async function runMigrations(connectionString: string) {
  const { db, pool } = createDb(connectionString, { max: 1 })
  const here = path.dirname(fileURLToPath(import.meta.url))
  try {
    await migrate(db, { migrationsFolder: path.resolve(here, "../../drizzle") })
  } finally {
    await pool.end()
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")
  await runMigrations(url)
  console.log("Migrations applied.")
}
