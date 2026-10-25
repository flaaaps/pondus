/** Writes the OpenAPI document to apps/api/openapi.json without a database. */
import { writeFileSync } from "node:fs"
import { buildApp } from "./app.js"
import { loadEnv } from "./config/env.js"

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://x:y@127.0.0.1:1/x",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "x".repeat(32),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "y".repeat(32),
})
const app = await buildApp({ env, logger: false, db: {} as never })
await app.ready()
writeFileSync(new URL("../openapi.json", import.meta.url), JSON.stringify(app.swagger(), null, 2))
await app.close()
console.log("openapi.json written")
