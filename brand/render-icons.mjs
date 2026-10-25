// Renders the SVG brand sources to the PNGs Expo needs. Run: pnpm brand:icons
import { Resvg } from "@resvg/resvg-js"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, "../apps/mobile/assets")
mkdirSync(out, { recursive: true })
const render = (src, file, width, extra = {}) => {
  const svg = readFileSync(path.join(here, src), "utf8")
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width }, ...extra }).render().asPng()
  writeFileSync(path.join(out, file), png)
  console.log(`${file} (${width}px)`)
}
render("app-icon.svg", "icon.png", 1024)
render("splash-icon.svg", "splash-icon.png", 400)
render("pondus-mark.svg", "mark-dark.png", 512, { background: "rgba(0,0,0,0)" })
