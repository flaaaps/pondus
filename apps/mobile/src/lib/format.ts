import { SPLIT_LABELS as SHARED_SPLIT_LABELS, formatWeight as formatWeightShared, gramsToUnit, type WeightUnit } from "@pondus/shared"

/** Weight with a German decimal comma: "92,5 kg" (the shared formatter is locale-neutral). */
export function formatWeight(grams: number | null, unit: WeightUnit, opts: { withUnit?: boolean } = {}): string {
  return formatWeightShared(grams, unit, opts).replace(".", ",")
}

export function kgLabel(grams: number | null, unit: WeightUnit) {
  return formatWeight(grams, unit)
}

/** Tonnage in a compact form: 12,4 t / 850 kg. */
export function formatTonnage(grams: number, unit: WeightUnit): string {
  const v = gramsToUnit(grams, unit)
  if (unit === "kg" && v >= 1000) return `${(v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} t`
  return `${Math.round(v).toLocaleString("de-DE")} ${unit}`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "–"
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h} h ${m % 60} min`
  return `${m} min`
}

export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
export const WEEKDAYS_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Date(iso).toLocaleDateString("de-DE", opts)
}
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}
export function relativeDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / 86400000)
  if (diff === 0) return "Heute"
  if (diff === -1) return "Gestern"
  if (diff === 1) return "Morgen"
  if (diff > 1 && diff < 7) return WEEKDAYS_LONG[d.getDay()]!
  return formatDate(iso, { weekday: "short", day: "numeric", month: "short" })
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const GOAL_LABELS: Record<string, string> = {
  hypertrophy: "Muskelaufbau",
  strength: "Kraft",
  general_fitness: "Allgemeine Fitness",
  return_to_training: "Wiedereinstieg",
  muscle_focus: "Gezielte Muskelgruppen",
}
export const EXPERIENCE_LABELS: Record<string, string> = { beginner: "Anfänger", intermediate: "Fortgeschritten", advanced: "Erfahren" }
export const ENVIRONMENT_LABELS: Record<string, string> = { full_gym: "Voll ausgestattetes Studio", limited_gym: "Kleines Studio", home: "Zu Hause", custom: "Eigene Auswahl" }
/** Split labels live in @pondus/shared (also used for plan names and adjustment diffs). */
export const SPLIT_LABELS: Record<string, string> = SHARED_SPLIT_LABELS
export const CATEGORY_LABELS: Record<string, string> = { compound: "Grundübung", isolation: "Isolation", core: "Rumpf", cardio: "Cardio", mobility: "Mobilität", warmup: "Aufwärmen" }
export const DIFFICULTY_LABELS: Record<string, string> = { beginner: "Einsteiger", intermediate: "Fortgeschritten", advanced: "Anspruchsvoll" }
export const SET_TYPE_LABELS: Record<string, string> = { warmup: "Aufwärmen", working: "Arbeitssatz", drop: "Dropset", superset: "Supersatz", failure: "Bis Versagen", backoff: "Back-off" }
/** Value of a personal record: "12 × 80 kg" for reps at a weight, else the weight; estimates rounded to 100 g. */
export function formatRecordValue(r: { type: string; reps: number | null; weightGrams: number | null; valueGrams: number | null; isEstimate: boolean }, unit: WeightUnit): string {
  if (r.type === "max_reps_at_weight") return `${r.reps} × ${formatWeight(r.weightGrams, unit)}`
  const grams = r.valueGrams ?? r.weightGrams
  return formatWeight(grams !== null && r.isEstimate ? Math.round(grams / 100) * 100 : grams, unit)
}

export const RECORD_TYPE_LABELS: Record<string, string> = {
  max_weight: "Neues Maximalgewicht",
  max_reps_at_weight: "Mehr Wiederholungen",
  max_set_volume: "Bestes Satzvolumen",
  max_session_volume: "Bestes Einheitsvolumen",
  estimated_1rm: "Geschätztes 1RM",
}
