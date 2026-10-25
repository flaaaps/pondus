# Pondus – API

Basis: `/api/v1`. Auth: `Authorization: Bearer <accessToken>` (alle Endpunkte außer `/auth/register|login|refresh` und `/health`). Vollständige, generierte Dokumentation: Swagger UI unter `/docs` (Dev) bzw. `pnpm --filter @pondus/api openapi` → `apps/api/openapi.json`. Alle Schemas stammen aus `packages/shared/src/schemas`.

## Konventionen

- JSON; Zeiten ISO-8601 mit Offset; Gewichte in **Gramm** (Integer).
- Fehler: `{ "error": { "code", "message", "details?", "requestId" } }`. Codes u. a. `validation_error` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404), `email_taken`, `workout_already_active`, `workout_not_open`, `preview_expired`, `plan_changed`, `idempotency_key_reused` (409), `rate_limited` (429).
- Pagination: `limit` + opaker `cursor`, Antwort `{ items, nextCursor }`.
- Idempotenz: optionaler Header `Idempotency-Key` (8–128 Zeichen) auf POST/PUT/PATCH; Replay liefert dieselbe Antwort mit `Idempotent-Replayed: true`.

## Endpunkte

### Auth
| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| POST | `/auth/register` | `{ email, password, displayName }` → `{ user, tokens }` (201) |
| POST | `/auth/login` | → `{ user, tokens }` |
| POST | `/auth/refresh` | `{ refreshToken }` → neues Paar (Rotation; alter Token ungültig) |
| POST | `/auth/logout` | `{ refreshToken? }` → 204 (ohne Token: alle Sessions) |
| GET | `/auth/me` | aktueller Nutzer |

### Users (`/me`)
| PATCH | `/me` | `displayName`, `weightUnit`, `locale`, `onboardingCompleted` |
| GET/PUT | `/me/profile` | Trainingsprofil inkl. `musclePriorities` (PUT ist partiell) |
| PUT | `/me/profile/muscle-priorities` | Rangfolge ersetzen |
| GET/PUT | `/me/exercise-preferences` | `{ preferred[], excluded[] }` (vollständiger Ersatz, keine Überschneidung) |
| GET | `/me/export` | Alle Nutzerdaten als JSON |
| DELETE | `/me` | Konto löschen (kaskadiert) |

### Exercises
| GET | `/exercises` | `q`, `muscles`, `equipment`, `category`, `difficulty` (CSV), `unilateral`, `favorites`, `custom`, `recent`, `sort=name|recent`, `limit`, `cursor` → `{ items, nextCursor, total }` |
| GET | `/exercises/muscle-groups` | |
| POST | `/exercises` | eigene Übung (201) |
| GET/PATCH/DELETE | `/exercises/:id` | Detail / eigene bearbeiten / eigene soft-löschen |
| GET | `/exercises/:id/alternatives` | kuratiert + berechnet, mit `reasons` |
| PUT/DELETE | `/exercises/:id/favorite` | |
| GET | `/exercises/:id/history` | Sätze je abgeschlossenem Workout, `from`/`to` |

### Plans
| GET | `/plans` | Zusammenfassungen |
| GET | `/plans/active` | aktiver Plan mit aktueller Version oder `null` |
| GET | `/plans/week?date&timeZone` | Wochenansicht: Sessions mit Datum nach Overrides, Status, Workout-Link, `nextSessionId` |
| POST | `/plans/generate` | `{ name?, splitType?, activate=true }` → Plan (201); archiviert den bisher aktiven |
| GET | `/plans/sessions/:id` | Session-Detail |
| POST | `/plans/sessions/:id/override` | `{ weekStart, action: move|skip|reset, date? }` → Woche |
| GET | `/plans/:id` · `/plans/:id/versions/:n` | |
| POST | `/plans/:id/activate` · `/archive` | |
| POST | `/plans/:id/edit` | `{ ops[] }` – `rename_plan`, `rename_session`, `move_session`, `reorder_sessions`, `add_session`, `remove_session`, `add_exercise`, `remove_exercise`, `duplicate_exercise`, `swap_exercise`, `update_exercise`, `reorder_exercises` → neue Version |
| POST | `/plans/:id/adjustments/preview` | `{ weeklyFrequency?, sessionDurationMinutes?, splitType?, weekdays?, updateProfile=true }` → `{ previewId, expiresAt, proposal, diff }` |
| POST | `/plans/:id/adjustments/apply` | `{ previewId }` → neue Version (+ Profil-Update) |
| DELETE | `/plans/:id/adjustments/:previewId` | verwerfen |

### Workouts
| GET | `/workouts` | Historie (`from`, `to`, `exerciseId`, `status`, Cursor) |
| GET | `/workouts/active` | laufendes/pausiertes Workout oder `null` |
| POST | `/workouts` | `{ clientId, source: plan_session | repeat_workout | empty | plan_session_client, startedAt? }` → 201 neu / 200 bereits vorhanden |
| GET/PATCH | `/workouts/:id` | |
| POST | `/workouts/:id/exercises` | hinzufügen (`replacesWorkoutExerciseId` für „nur heute tauschen“) |
| PATCH | `/workouts/:id/exercises/:exerciseId` | `skipped`, `notes`, `restSeconds`, `sequence` |
| PUT | `/workouts/:id/exercises/:exerciseId/sets` | Satz-Upsert per `clientId`, Konfliktauflösung über `updatedAt` |
| DELETE | `/workouts/:id/sets/:setIdOrClientId` | |
| POST | `/workouts/:id/pause` · `/resume` · `/cancel` | |
| POST | `/workouts/:id/complete` | → Zusammenfassung (Dauer, Sätze, Wdh., Tonnage, Rekorde, Vergleich); idempotent |
| GET | `/workouts/:id/summary` | |

### Progress
| GET | `/progress/overview?range=4w|8w|12w|6m|1y|all&timeZone` | Wochenstatistik, Streak, letzte Einheit, Rekorde, Muskelverteilung |
| GET | `/progress/exercises/:id?range` | Verlauf, Bestwerte, Progressionsempfehlung |
| GET | `/progress/records?exerciseId&limit&cursor` | |

### Sync
| POST | `/sync/workouts` | `{ mutations[] }` (max. 500) → `{ applied, results[{ index, status, message? }], workouts[] }` |
