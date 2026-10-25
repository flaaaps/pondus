import { defineConfig } from "astro/config"

// GitHub Pages serves the project site under /pondus/. The Pages workflow passes the real origin and
// base path (an empty base with a custom domain), so locally the defaults below apply.
const base = process.env.PONDUS_WEB_BASE

export default defineConfig({
  site: process.env.PONDUS_WEB_SITE || "https://flaaaps.github.io",
  base: base === undefined ? "/pondus" : base || "/",
  build: { inlineStylesheets: "always" },
})
