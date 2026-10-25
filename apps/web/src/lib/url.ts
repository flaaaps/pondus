/** Path inside the site, so links work at the root and under a base path (GitHub Pages: /pondus/). */
export function url(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "")
  return `${base}/${path.replace(/^\//, "")}`
}
