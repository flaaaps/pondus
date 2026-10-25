import { startDevPostgres } from "../src/db/dev-postgres.js"
import { runMigrations } from "../src/db/migrate.js"
import { createDb } from "../src/db/client.js"
import { seedReferenceData } from "../src/db/seed.js"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

export default async function setup() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "pondus-pg-"))
  const { url, stop } = await startDevPostgres({ dataDir, port: 54339, persistent: false, database: "pondus_test" })
  await runMigrations(url)
  const { db, pool } = createDb(url, { max: 2 })
  await db.transaction(tx => seedReferenceData(tx))
  await pool.end()
  process.env.TEST_DATABASE_URL = url
  return async () => {
    await stop()
    rmSync(dataDir, { recursive: true, force: true })
  }
}
