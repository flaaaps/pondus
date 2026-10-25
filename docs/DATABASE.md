# Pondus – Datenbank

PostgreSQL ≥ 16, Drizzle ORM (`apps/api/src/db/schema.ts`), Migrationen in `apps/api/drizzle/` (SQL, generiert mit `drizzle-kit generate`, angewandt mit `pnpm db:migrate`). IDs sind UUIDv4 (`gen_random_uuid()`), Zeitstempel `timestamptz`, Gewichte Integer-Gramm, Volumen `bigint`.

## Entitäten

| Tabelle | Zweck | Besonderheiten |
| --- | --- | --- |
| `users` | Konto | `email` mit Unique-Index auf `lower(email)`, `password_hash` (Argon2id), `weight_unit`, `locale`, `onboarding_completed_at`, `deleted_at` |
| `refresh_tokens` | Sessions | nur SHA-256-Hash, `expires_at`, `revoked_at`, `user_agent` |
| `user_training_profiles` | Trainingsprofil (1:1) | Ziel(e), Erfahrung, Dauer, Frequenz, Umgebung, Equipment-Array, bevorzugte Wochentage |
| `muscle_groups` | 12 Gruppen | Enum-Slug, DE/EN-Namen, Region, Reihenfolge |
| `exercises` | System- und eigene Übungen | `is_system`, `owner_user_id` (eigene), `deleted_at` (Soft Delete), Equipment-Array, Kategorie, Bewegungsmuster, Hinweise |
| `exercise_muscles` | Übung↔Muskel | `role` primary/secondary |
| `exercise_alternatives` | kuratierte Alternativen | ergänzt die berechneten Alternativen |
| `user_exercise_preferences` | bevorzugt/ausgeschlossen | PK (user, exercise) |
| `user_exercise_favorites` | Favoriten | |
| `user_muscle_priorities` | Fokusmuskeln | `priority` 1 = höchste |
| `training_plans` | Plan-Kopf | `status` draft/active/archived, `current_version_number`, **partieller Unique-Index: ein aktiver Plan pro Nutzer** |
| `training_plan_versions` | unveränderliche Versionen | Split, Frequenz, `weekly_sets` jsonb, `rationale` jsonb, `change_reason` generated/edited/adjusted |
| `training_plan_sessions` | Einheiten einer Version | `weekday` (0–6, null = flexibel), `focus_muscles`, geschätzte Dauer |
| `training_plan_exercises` | Übungen einer Einheit | Sätze, Wdh.-Bereich, Pause, RIR, Aufwärmsätze, Notizen; FK auf `exercises` mit `restrict` |
| `session_overrides` | Kalender-Overrides pro Woche | (session, `week_start`) unique; `moved` + Datum oder `skipped` |
| `plan_adjustment_previews` | Vorschauen | Proposal + Diff jsonb, `base_version_number`, Ablauf 30 min, `applied_at` |
| `workouts` | Trainingseinheiten | `client_id` (unique je Nutzer → idempotenter Start), Status, Plan-/Versions-/Session-Referenzen (`set null`), Pausenzeit, Dauer |
| `workout_exercises` | Übungen im Workout | `exercise_name_snapshot`, Ziele kopiert, `skipped`, `client_id` unique je Workout; `exercise_id` `set null` bei Löschung |
| `workout_sets` | Sätze | Typ, Gramm, Wdh., RIR, RPE, completed, Zielwerte, `client_updated_at` (Konfliktauflösung) |
| `personal_records` | erkannte Rekorde | Typ, Werte, Workout-Referenz, `is_estimate` |
| `exercise_bests` | laufende Bestwerte je Nutzer/Übung | Cache für Rekorderkennung |
| `idempotency_keys` | HTTP-Idempotenz | (user, key), Request-Hash, gespeicherte Antwort, 48 h |

## Integrität und Löschstrategie

- Alle nutzerbezogenen Tabellen kaskadieren bei `users`-Löschung (Account-Löschung = ein `DELETE`).
- Plan → Versionen → Einheiten → Übungen kaskadieren; `training_plan_exercises.exercise_id` ist `restrict`, eigene Übungen werden daher nur **soft** gelöscht und die API verweigert das Löschen, solange die Übung im aktiven Plan steckt.
- Workouts referenzieren Pläne/Versionen/Sessions mit `set null`: Historie bleibt auch nach Planlöschung lesbar; Namen liegen als Snapshot im Workout.
- Versionen sind unveränderlich; jede Planänderung schreibt eine neue Version. Abgeschlossene Workouts zeigen auf ihre ursprüngliche Version (Test: „plan edits never change completed workouts“).
- Zusammenhängende Schreibvorgänge (Registrierung, Versionsschreiben, Workout-Start, Abschluss mit Rekorden) laufen in Transaktionen.

## Indizes

Unique: E-Mail (lower), Refresh-Hash, Übungs-Slug, Plan/Version, (user, client_id) Workouts, (workout, client_id) Übungen, (workout_exercise, client_id) Sätze, Overrides. B-Tree für `user_id`-Zugriffe, `workouts(user_id, started_at)`, `workouts(user_id, status)`, `personal_records(user_id, exercise_id)`, `exercise_muscles(muscle_group_id, role)`.

## Lokale Entwicklung ohne Postgres-Server

`pnpm --filter @pondus/api db:dev` startet einen eingebetteten PostgreSQL-17-Cluster (Paket `embedded-postgres`, Daten in `apps/api/.pgdata`, Port 54329) – ohne Docker oder Root. Die Integrationstests starten sich einen temporären Cluster selbst. Ein vorhandener Server wird über `DATABASE_URL` genutzt; bei gemeinsam genutzten Servern eine eigene Datenbank `pondus` anlegen (die Tabellen tragen keine Präfixe, ein eigenes Schema wäre über `search_path` möglich).

## Seed

`pnpm --filter @pondus/api db:seed` schreibt Muskelgruppen und die System-Übungsbibliothek idempotent (Upsert per Slug; Muskel-Links und Alternativen werden für Systemübungen neu aufgebaut). Nutzer- oder Demo-Daten werden nie geseedet. Testnutzer: `pnpm --filter @pondus/api db:create-test-user [email] [passwort]` (verweigert in Production).
