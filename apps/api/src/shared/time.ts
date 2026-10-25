/** Monday-based week start as YYYY-MM-DD in the given IANA time zone (defaults to UTC). */
export function weekStartISO(d: Date, timeZone = "UTC"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ""
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"))
  const local = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))))
  const diff = (weekday + 6) % 7
  local.setUTCDate(local.getUTCDate() - diff)
  return local.toISOString().slice(0, 10)
}
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export const toIso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
