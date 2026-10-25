/**
 * Starts an embedded PostgreSQL cluster for local development and tests when no
 * PostgreSQL server is available (e.g. on a machine without Docker or root).
 * Data lives in apps/api/.pgdata (git-ignored). Usage: `pnpm db:dev`.
 */
import EmbeddedPostgres from "embedded-postgres"
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The platform package ships its shared libraries without the `.so.N` symlinks
 * (npm tarballs cannot contain symlinks) and relies on a postinstall script.
 * Package managers that block build scripts (pnpm by default) skip it, so we
 * recreate any missing symlinks here before spawning the binaries.
 */
function hydrateSymlinks() {
  const platformPkg = `@embedded-postgres/${process.platform}-${process.arch}`
  let pkgJson: string
  try {
    pkgJson = createRequire(import.meta.url).resolve(`${platformPkg}/package.json`)
  } catch {
    return
  }
  const root = path.dirname(pkgJson)
  const manifest = path.join(root, "native", "pg-symlinks.json")
  if (!existsSync(manifest)) return
  const links = JSON.parse(readFileSync(manifest, "utf8")) as { source: string; target: string }[]
  for (const { source, target } of links) {
    const targetPath = path.join(root, target)
    if (existsSync(targetPath)) continue
    try {
      symlinkSync(path.relative(path.dirname(targetPath), path.join(root, source)), targetPath)
    } catch {
      /* best effort */
    }
  }
}

export interface DevPostgresOptions {
  port?: number
  dataDir?: string
  persistent?: boolean
  database?: string
}

export async function startDevPostgres(opts: DevPostgresOptions = {}) {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const dataDir = opts.dataDir ?? path.resolve(here, "../../.pgdata")
  const port = opts.port ?? 54329
  const database = opts.database ?? "pondus"
  mkdirSync(dataDir, { recursive: true })
  hydrateSymlinks()
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "pondus",
    password: "pondus",
    port,
    persistent: opts.persistent ?? true,
    onLog: () => {},
    onError: message => {
      if (process.env.DEBUG_PG) console.error(String(message))
    },
  })
  let fresh = false
  try {
    await pg.initialise()
    fresh = true
  } catch {
    // already initialised
  }
  await pg.start()
  if (fresh) await pg.createDatabase(database)
  else {
    try {
      await pg.createDatabase(database)
    } catch {
      /* exists */
    }
  }
  const url = `postgres://pondus:pondus@127.0.0.1:${port}/${database}`
  return { pg, url, stop: () => pg.stop() }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const { url, stop } = await startDevPostgres()
  console.log(`Embedded PostgreSQL ready at ${url}`)
  console.log("Press Ctrl+C to stop.")
  const shutdown = async () => {
    await stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
  await new Promise(() => {})
}
