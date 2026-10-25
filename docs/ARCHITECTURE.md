# Pondus – Architektur

## Überblick

```
pondus/ (pnpm workspace)
├── packages/shared   Domain-Logik + API-Verträge (zod), Übungsbibliothek – läuft in Node und RN
├── apps/api          Fastify 5 + Drizzle ORM + PostgreSQL
└── apps/mobile       Expo SDK 58 / React Native 0.88, iOS-only, Expo Router
```

Die App spricht ausschließlich mit der REST-API (`/api/v1`). PostgreSQL ist nie direkt erreichbar. Die Trainingslogik lebt in `@pondus/shared` und wird serverseitig ausgeführt (Plan-Generierung, Anpassung, Rekorde, Progression); die App nutzt dieselben Funktionen nur für lokale Anzeige (Tonnage, Split-Erklärung im Onboarding).

## packages/shared

- `domain/muscles.ts` – 12 Muskelgruppen, Überlappungsmatrix.
- `domain/equipment.ts` – 16 Equipment-Typen, Umgebungs-Presets.
- `domain/types.ts` – Kategorien, Bewegungsmuster, Profil-, Plan-Draft-Typen.
- `domain/heuristics.ts` – alle Planungszahlen (konfigurierbar).
- `domain/splits.ts`, `scoring.ts`, `planner.ts`, `adjust.ts`, `schedule.ts`, `duration.ts`, `volume.ts` – Planung.
- `domain/progression.ts`, `records.ts`, `units.ts` – Fortschritt.
- `schemas/*` – zod-Schemas = API-Vertrag; Fastify validiert damit Requests/Responses und erzeugt OpenAPI; die App importiert die Typen.
- `library/*` – 160+ System-Übungen als Seed-Daten mit Muskeln, Equipment, Hinweisen, Alternativen.

## apps/api

```
src/app.ts            buildApp(): Plugins, Swagger, Routen
src/server.ts         Prozess-Entry (Env, Listen, Shutdown)
src/config/env.ts     zod-validierte Umgebungsvariablen
src/plugins/          db (Pool), auth (@fastify/jwt), error-handler, idempotency (Idempotency-Key)
src/modules/<name>/   routes.ts (HTTP, Schemas) · service.ts (Fachlogik) · repo/persist (DB-Zugriff)
src/db/               schema.ts (Drizzle), client.ts, migrate.ts, seed.ts, dev-postgres.ts, create-test-user.ts
drizzle/              generierte SQL-Migrationen (reproduzierbar, eingecheckt)
```

Module: `auth`, `users` (Profil, Präferenzen, Export, Löschung), `exercises`, `training-plans` (Versionen, Edits, Vorschau, Woche, Overrides), `workouts`, `progress`, `sync`.

Querschnitt:
- **Auth:** Argon2id-Passwort-Hash, JWT-Access-Token (15 min), opakes Refresh-Token (SHA-256-Hash in DB, Rotation bei Refresh, Revocation bei Logout).
- **Autorisierung:** jede Abfrage filtert auf `user_id`; fremde IDs → 404.
- **Fehler:** einheitliches `{ error: { code, message, details?, requestId } }`.
- **Idempotenz:** Header `Idempotency-Key` (Antwort-Replay) + fachliche Client-IDs (Workout, Übung, Satz).
- **Rate Limiting:** global 300/min, Auth-Endpunkte 10/min.
- **Logging:** pino, Redaction von Tokens/Passwörtern, Request-ID.
- **OpenAPI:** `/docs` (nicht in Production), `pnpm openapi` schreibt `openapi.json`.

## apps/mobile

```
src/app/              Expo-Router-Routen: (auth), (onboarding), (tabs)/{index,plan,exercises,progress,profile}, workout/*
src/design-system/    Tokens, Theme, Komponenten
src/features/<name>/  React-Query-Hooks, Stores (active-workout-store, draft-store, picker-store)
src/services/         session-store (Keychain-Tokens, API-Client), settings-store, rest-timer-store, sync
src/storage/          SQLite (kv + outbox), local-reducer (spiegelt Server-Mutationen), active-workout
src/lib/              api-client, query-client (persistiert), format, haptics, uuid, env
src/components/       Feature-Komponenten (SetRow, RestTimerBar, ExerciseList …)
```

State-Schichten:
1. **Server-State:** TanStack Query, persistiert in AsyncStorage (Plan, Woche, Übungen, Fortschritt offline lesbar).
2. **Workout-State (lokal-first):** zustand-Store + SQLite. Jede Aktion → Reducer (`applyLocalMutation`) → Persist → Outbox → Flush.
3. **Session/Settings:** zustand (+ SecureStore für Tokens, AsyncStorage für Einstellungen).

## Offline & Synchronisation

- **Outbox** (`storage/outbox.ts`): Append-only-Queue von `SyncMutation`s (Start, Übung hinzufügen/ändern, Satz upsert/löschen, Pause/Resume, Complete, Cancel), in Reihenfolge als Batch an `POST /sync/workouts`. Jede Mutation trägt Client-IDs → serverseitig idempotent; Antwort pro Mutation `applied | duplicate | conflict | error`. Netzwerkfehler: nichts wird entfernt. Fachliche Ablehnung: Eintrag wird entfernt und dem Nutzer gemeldet.
- **Flush-Trigger:** nach jeder Mutation, bei App-Foreground, alle 15 s solange Einträge offen sind. Kein Background-Processing.
- **Autorität:** Solange die Queue nicht leer ist, gilt der lokale Stand. Ist sie leer, wird die Serverkopie übernommen (IDs, „zuletzt“-Werte).
- **Konflikte:**
  - Satz offline geändert: `upsert_set` mit Client-Zeitstempel; der Server behält die neuere Version (`client_updated_at`), eine ältere wird als `duplicate` quittiert → kein stilles Überschreiben neuerer Daten.
  - Workout auf anderem Gerät abgeschlossen: Mutationen auf ein abgeschlossenes Workout werden mit `conflict` abgelehnt und dem Nutzer gezeigt; Replays bereits angewandter Sätze bleiben `duplicate`.
  - Plan auf dem Server geändert: Workouts referenzieren die Planversion; der Client lädt die aktuelle Version bei Sichtbarkeit nach. Vorschau-Anwendung prüft `baseVersionNumber` → `plan_changed`.
  - Request mehrfach gesendet: Client-IDs (Workout/Übung/Satz) und `Idempotency-Key`.
- **Offline-Start:** online wird `plan_session` genutzt (Server erzeugt Übungen + Vorbelegung aus letzter Leistung). Offline baut der Client die Einheit aus dem gecachten Plan und sendet `plan_session_client` + `add_exercise`-Mutationen; der Server verknüpft die Plan-Session.

## Zeit und Einheiten

- Zeitpunkte werden als `timestamptz` (UTC) gespeichert und als ISO-8601 übertragen; Anzeige in lokaler Zeit. Wochenansicht nimmt die Zeitzone des Clients (`timeZone`-Parameter).
- Gewichte sind **Integer-Gramm** im Datenmodell und in der API; Anzeige in kg/lb über `units.ts`.
