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
| GET | `/me/export` | Alle Nutzerdaten als JSON (inkl. `exerciseNotes`) |
| DELETE | `/me` | Konto löschen (kaskadiert) |

### Exercises
| GET | `/exercises` | Jede Übung trägt `note` (dauerhafte Nutzer-Notiz oder `null`) und `noteUpdatedAt`. `q`, `muscles`, `equipment`, `category`, `difficulty` (CSV), `unilateral`, `favorites`, `custom`, `recent`, `sort=name|recent`, `limit`, `cursor` → `{ items, nextCursor, total }`. `q` wird normalisiert (Groß/Klein, ä/ae/a, ö/oe/o, ü/ue/u, ß/ss, Bindestriche/Satzzeichen) und tokenweise gematcht: jedes Wort muss in Name (de/en), Slug oder Alias vorkommen („bankdrucken“, „bank drücken“ → „Bankdrücken mit Langhantel“). Treffer mit Namensanfang zuerst. CSV-Filter sind ODER-verknüpft innerhalb eines Filters, auch `equipment`: Eine Übung passt, wenn sie **irgendein** gewähltes Gerät nutzt (`equipment=barbell,dumbbell` → Langhantel- oder Kurzhantelübungen). Verschiedene Filter sind UND-verknüpft. |
| GET | `/exercises/muscle-groups` | |
| POST | `/exercises` | eigene Übung (201) |
| GET/PATCH/DELETE | `/exercises/:id` | Detail / eigene bearbeiten / eigene soft-löschen |
| GET | `/exercises/:id/alternatives` | kuratiert + berechnet, mit `reasons` |
| PUT/DELETE | `/exercises/:id/favorite` | |
| PUT | `/exercises/:id/note` | `{ note: string \| null (max. 500), updatedAt? }` → Übung. Dauerhafte Notiz des Nutzers zur Übung; getrimmt, leer/`null` = löschen. `updatedAt` (Bearbeitungszeit des Clients, Default jetzt, auf Serverzeit begrenzt): eine ältere Änderung als die gespeicherte wird ignoriert (Last Writer Wins), die Antwort zeigt dann die gespeicherte Notiz |
| DELETE | `/exercises/:id/note` | Notiz löschen → Übung |
| GET | `/exercises/:id/history` | Sätze je abgeschlossenem Workout, `from`/`to` |

### Plans
| GET | `/plans` | Zusammenfassungen |
| GET | `/plans/active` | aktiver Plan mit aktueller Version oder `null` |
| GET | `/plans/week?date&timeZone` | Wochenansicht: Sessions mit Datum nach Overrides, Status, Workout-Link, `nextSessionId`, `today`, `timeZone`. „Heute“ und die Standardwoche kommen aus `timeZone` (IANA, Default/Fallback `Europe/Berlin`). Overrides und Workouts werden über `sessionKey` zugeordnet und überleben Planänderungen |
| POST | `/plans/generate` | `{ name?, splitType?, activate=true }` → Plan (201); archiviert den bisher aktiven |
| GET | `/plans/sessions/:id` | Session-Detail |
| POST | `/plans/sessions/:id/override?timeZone` | `{ weekStart, action: move|skip|reset, date? }` → Woche. Gilt für den `sessionKey` der Session (eine Override-Zeile je Nutzer/Key/Woche), also auch für spätere Versionen |
| GET | `/plans/:id` · `/plans/:id/versions/:n` | |
| POST | `/plans/:id/activate` · `/archive` | |
| POST | `/plans/:id/edit` | `{ ops[] }` – `rename_plan`, `rename_session`, `move_session`, `reorder_sessions`, `add_session`, `remove_session`, `add_exercise`, `remove_exercise`, `duplicate_exercise`, `swap_exercise`, `update_exercise`, `reorder_exercises` → neue Version. Folge-Edits innerhalb von 120 s auf eine durch Edit entstandene Version, die noch von keinem Workout und keiner offenen Anpassungs-Vorschau referenziert wird, aktualisieren diese Version in place (gleiche `versionNumber`, gleiche Session-`id`s; Plan-Exercise-`id`s ändern sich). Sessions behalten in jedem Fall ihren `sessionKey` |
| POST | `/plans/:id/adjustments/preview` | `{ weeklyFrequency?, sessionDurationMinutes?, splitType?, weekdays?, updateProfile=true }` → `{ previewId, expiresAt, proposal, diff }` |
| POST | `/plans/:id/adjustments/apply` | `{ previewId }` → neue Version (+ Profil-Update). `sessionKey`s werden per `sequence` übernommen. Trägt der Plan noch den Auto-Namen (z. B. „Ganzkörper · 3× pro Woche“), wird er an Split/Frequenz angepasst; manuelle Namen bleiben |
| DELETE | `/plans/:id/adjustments/:previewId` | verwerfen |

### Workouts
| GET | `/workouts` | Historie (`from`, `to`, `exerciseId`, `status`, Cursor) |
| GET | `/workouts/active` | laufendes/pausiertes Workout oder `null` |
| POST | `/workouts` | `{ clientId, source: plan_session | repeat_workout | empty | plan_session_client, startedAt? }` → 201 neu / 200 bereits vorhanden. Übungen mit Wdh.-Bereich (Plan-Session, Wiederholen, Hinzufügen mit `targetRepsMin/Max`) bekommen `nextTarget = { kind: increase_load|increase_reps|hold|deload|no_data, weightGrams, repsPerSet[], targetRir, lastWeightGrams, basedOn, reason }` (Doppelprogression aus den letzten 2 Einheiten). Arbeitssätze werden mit dem Ziel vorbelegt (`targetWeightGrams/targetReps` und `weightGrams/reps`); ohne Ziellast (no_data, Körpergewicht) bleibt das zuletzt geloggte Gewicht bzw. leer. `previous` zeigt weiter die letzten Werte. Bei `loadType = assisted` ist Gewicht = Unterstützung (weniger = schwerer); dafür gibt es keine Gewichts-/Volumen-/e1RM-Rekorde, und die Tonnage ist 0 (Körpergewicht unbekannt). Erste Einheit einer Übung erzeugt keine Rekorde |
| GET/PATCH | `/workouts/:id` | |
| POST | `/workouts/:id/exercises` | hinzufügen (`replacesWorkoutExerciseId` für „nur heute tauschen“: Server-ID oder Client-ID; die ersetzte Übung wird übersprungen, die neue zeigt per `replacesWorkoutExerciseId` auf sie) |
| DELETE | `/workouts/:id/exercises/:exerciseId` | Übung samt Sätzen entfernen (ID oder Client-ID; idempotent, Reihenfolge schließt die Lücke) |
| PATCH | `/workouts/:id/exercises/:exerciseId` | `skipped`, `notes` (Notiz nur zu diesem Workout, nicht die dauerhafte Übungsnotiz), `restSeconds`, `sequence` |
| PUT | `/workouts/:id/exercises/:exerciseId/sets` | Satz-Upsert per `clientId`, Konfliktauflösung über `updatedAt` |
| DELETE | `/workouts/:id/sets/:setIdOrClientId` | |
| POST | `/workouts/:id/pause` · `/resume` · `/cancel` | |
| POST | `/workouts/:id/complete` | → Zusammenfassung (Dauer, Sätze, Wdh., Tonnage, Rekorde, Vergleich); idempotent |
| GET | `/workouts/:id/summary` | |

### Progress
| GET | `/progress/overview?range=4w|8w|12w|6m|1y|all&timeZone` | Wochenstatistik, Streak, letzte Einheit, Rekorde, Muskelverteilung, `muscleWeeklySets: [{ muscle, label, actualSets, targetSets }]` (diese Woche, primär = 1, sekundär = 0,5, vs. `weeklySets` der aktiven Planversion). `timeZone` Default `Europe/Berlin` |
| GET | `/progress/exercises/:id?range` | Verlauf, Bestwerte, Progressionsempfehlung |
| GET | `/progress/records?exerciseId&limit&cursor` | |

### Sync
| POST | `/sync/workouts` | `{ mutations[] }` (max. 500; Arten: `start_workout`, `add_exercise`, `update_exercise`, `remove_exercise`, `upsert_set`, `delete_set`, `pause`, `resume`, `complete`, `cancel`, `set_exercise_note`) → `{ applied, results[{ index, status, message? }], workouts[] }`. `set_exercise_note { exerciseId, body: { note, updatedAt } }` ist die dauerhafte Übungsnotiz (offline bearbeitbar, nicht an ein Workout gebunden): `applied`, `duplicate` (gespeicherte Notiz ist gleich alt oder neuer) oder `error` (Übung unbekannt/nicht sichtbar) |
