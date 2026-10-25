import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import pg from "pg"
import * as schema from "./schema.js"

export type Db = NodePgDatabase<typeof schema>
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
export type DbOrTx = Db | Tx

export function createDb(connectionString: string, opts: { max?: number } = {}) {
  const pool = new pg.Pool({
    connectionString,
    max: opts.max ?? 10,
    // Weights are integers; make sure bigint columns come back as numbers (values stay far below 2^53).
  })
  pg.types.setTypeParser(20, v => Number(v))
  pg.types.setTypeParser(1700, v => (v === null ? null : Number(v)))
  const db = drizzle(pool, { schema, casing: "snake_case" })
  return { db, pool }
}
