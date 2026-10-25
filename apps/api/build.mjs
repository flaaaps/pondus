import { build } from "esbuild"
import { readFileSync } from "node:fs"
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
// Bundle the API together with the workspace package; keep npm dependencies external.
await build({
  entryPoints: ["src/server.ts", "src/db/migrate.ts", "src/db/seed.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outdir: "dist",
  sourcemap: true,
  external: Object.keys(pkg.dependencies).filter(d => d !== "@pondus/shared"),
  logLevel: "info",
})
