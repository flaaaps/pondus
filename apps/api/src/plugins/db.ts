import fp from "fastify-plugin"
import { createDb, type Db } from "../db/client.js"

declare module "fastify" {
  interface FastifyInstance {
    db: Db
  }
}

export default fp(
  async (app, opts: { connectionString: string; db?: Db }) => {
    if (opts.db) {
      app.decorate("db", opts.db)
      return
    }
    const { db, pool } = createDb(opts.connectionString)
    app.decorate("db", db)
    app.addHook("onClose", async () => {
      await pool.end()
    })
  },
  { name: "db" },
)
