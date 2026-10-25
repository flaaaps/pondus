import { ApiError } from "./api-client"

/** German UI texts per API error code. Server messages are English and never shown directly. */
const MESSAGES: Record<string, string> = {
  network_error: "Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.",
  validation_error: "Die Eingaben sind unvollständig oder ungültig.",
  unauthorized: "Bitte melde dich erneut an.",
  forbidden: "Dafür fehlt dir die Berechtigung.",
  not_found: "Das wurde nicht gefunden. Vielleicht wurde es gerade gelöscht.",
  rate_limited: "Zu viele Versuche. Bitte warte einen Moment.",
  internal_error: "Auf dem Server ist ein Fehler aufgetreten. Bitte versuche es später erneut.",
  serialization_error: "Auf dem Server ist ein Fehler aufgetreten. Bitte versuche es später erneut.",
  email_taken: "Für diese E-Mail gibt es bereits ein Konto.",
  preference_conflict: "Eine Übung kann nicht gleichzeitig bevorzugt und ausgeschlossen sein.",
  unknown_exercise: "Diese Übung gibt es nicht (mehr).",
  duplicate_priority: "Jeder Muskel darf nur einmal vorkommen.",
  exercise_in_use: "Die Übung ist Teil deines aktiven Plans. Tausche sie dort zuerst aus.",
  workout_already_active: "Es läuft bereits ein Workout. Beende oder verwirf es zuerst.",
  workout_completed: "Das Workout ist bereits abgeschlossen.",
  workout_cancelled: "Das Workout wurde abgebrochen.",
  workout_not_completed: "Die Auswertung gibt es erst nach dem Abschluss.",
  last_session: "Ein Plan braucht mindestens eine Einheit.",
  invalid_rep_range: "Die minimalen Wiederholungen dürfen nicht über den maximalen liegen.",
  unknown_workout: "Das Workout wurde auf dem Server nicht gefunden.",
  unknown_workout_exercise: "Die Übung wurde im Workout nicht gefunden.",
  no_exercises: "Für dein Equipment und deine Präferenzen passen keine Übungen. Erweitere dein Equipment oder entferne Ausschlüsse.",
  preview_applied: "Diese Vorschau wurde bereits übernommen.",
  preview_expired: "Die Vorschau ist abgelaufen. Bitte erstelle eine neue.",
  plan_changed: "Der Plan wurde inzwischen geändert. Bitte erstelle eine neue Vorschau.",
  date_required: "Bitte wähle einen Tag aus.",
  invalid_idempotency_key: "Die Anfrage war ungültig. Bitte versuche es erneut.",
  idempotency_key_reused: "Die Anfrage wurde bereits gesendet. Bitte versuche es erneut.",
}

/** User-facing German message for any thrown value. Falls back to `fallback` for unknown codes. */
export function errorMessage(err: unknown, fallback = "Das hat leider nicht geklappt. Bitte versuche es erneut."): string {
  if (err instanceof ApiError) {
    if (err.isNetwork) return MESSAGES.network_error!
    const known = MESSAGES[err.code]
    if (known) return known
    if (err.status === 429) return MESSAGES.rate_limited!
    if (err.status >= 500) return MESSAGES.internal_error!
  }
  return fallback
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim())
}
