# Pondus – Implementierungsplan & Status

Stand: 25.10.2026. ✅ erledigt · 🟡 teilweise · ⬜ offen

## Phase 1 – Bestandsaufnahme ✅
- Arbeitsverzeichnis war leer (kein bestehendes Projekt). Umgebung: Raspberry Pi 5 (aarch64, 8 GB), Node 24, pnpm 12, kein PostgreSQL-Server, kein Docker, kein Xcode.
- Benachbartes StudyPilot-Monorepo analysiert: anderer Stack, nur Konventionen übernommen. Keine wiederverwendbare DB-Infrastruktur → eingebettetes PostgreSQL für Dev/Test.

## Phase 2 – Konzept & Dokumente ✅
PRODUCT_SPEC, BRAND_IDENTITY, DESIGN_SYSTEM, ARCHITECTURE, DATABASE, API, TECHNICAL_DECISIONS, dieser Plan.

## Phase 3 – Projektgrundlage ✅
pnpm-Workspace, TypeScript strict, ESLint (flat config), Prettier, Vitest/Jest, Env-Validierung, Fastify-App, Drizzle-Migrationen (`drizzle/0000_init.sql`), OpenAPI via Swagger.

## Phase 4 – Design-System ✅
Tokens (Farben light/dark, Typo, Abstände, Radien, Schatten, Motion, Größen), 16 Basis-Komponenten, Zustände (Loading/Error/Empty/Skeleton), Dark Mode, Glass-Fallback, Charts.
⬜ Sichtprüfung im iOS-Simulator (auf diesem Host nicht möglich – siehe „Offen“).

## Phase 5 – Datenmodell & Übungsbibliothek ✅
22 Tabellen, 160+ Systemübungen mit Muskeln/Equipment/Hinweisen/Alternativen, idempotenter Seed, Testnutzer-Skript.

## Phase 6 – Auth & Onboarding ✅
Registrierung, Login, Refresh-Rotation, Logout, Session-Wiederherstellung (offline-tolerant), 8-Schritte-Onboarding, Profil/Präferenzen/Fokus-Endpunkte.

## Phase 7 – Trainingsplanung ✅
Planner, Scoring, Splits, Zeitbudget, Regenerationsreihenfolge, Versionierung, 12 Edit-Operationen, Anpassungsvorschau mit Diff, Wochenansicht mit Overrides, Rationale. 27 Unit-Tests (shared) + Integrationstests (API).

## Phase 8 – Workout-Tracking ✅
Start (Plan/Repeat/leer/offline), Sätze (Upsert, Typen, RIR), Pause/Resume, Abschluss mit Rekorden & Vergleich, Historie, lokal-first Store, SQLite-Outbox, Sync-Endpunkt, Pausentimer mit Notification, Übungen tauschen/überspringen.

## Phase 9 – Fortschritt ✅
Overview (Wochenvolumen, Streak, Verteilung), Übungsentwicklung (Top-Satz, e1RM, Volumen), Rekorde, Progressionsempfehlung, Historie-Detail.

## Phase 10 – Qualitätssicherung 🟡
- ✅ `pnpm typecheck` (shared, api, mobile) grün.
- ✅ `pnpm lint` (shared, api, mobile) grün.
- ✅ Tests: shared 27, api 11 Integrationstests gegen echtes PostgreSQL, mobile 13 Unit-Tests (Reducer, Outbox, Format).
- ✅ Migrationen laufen in jedem Testlauf von null hoch.
- ⬜ **iOS-Simulator-Test, Layout-Prüfung auf Displaygrößen, Offline-Test am Gerät** – benötigt macOS/Xcode. Vorgehen: `pnpm install`, `pnpm --filter @pondus/mobile prebuild`, `pnpm --filter @pondus/mobile ios`.

## Abgedeckte Testfälle der Anforderung (Abschnitt 18)
1–7 (Anfänger 3×, Fortgeschritten 4×, Fokus Brust/Schultern, Präferenzen, Ausschlüsse, Equipment, Zeitreduktion): `packages/shared/test/planner.test.ts`.
8–9 (Frequenz erhöhen/reduzieren), 10 (Tausch), 11 (Verschieben): shared + `apps/api/test/plans.test.ts`.
12 (Workout bleibt bei Planänderung unverändert), 13 (Offline-Workout später synchronisieren), 14 (Request mehrfach): `apps/api/test/workouts.test.ts`, `apps/mobile/src/storage/__tests__/*`.

## Bekannte Einschränkungen
- Noch kein Lauf auf einem iPhone/Simulator; UI-Feinschliff (Abstände, Animationskurven, Glass-Kontraste) muss dort geprüft werden.
- `NativeTabs` ist laut Expo noch als Beta markiert; API-Änderungen in künftigen SDKs möglich.
- Markenname nur oberflächlich recherchiert; keine markenrechtliche Prüfung.
- Exporte sind JSON (kein CSV); Datenschutztext ist technisch, nicht juristisch geprüft.
- Mehrgeräte-Konflikte werden deterministisch aufgelöst, aber nicht in Echtzeit gepusht.
- Rate-Limit-Speicher ist prozesslokal (für mehrere API-Instanzen Redis-Store nötig).

## Nächste Schritte (Vorschlag)
1. Simulator-Durchlauf des Abnahmeflusses, Screenshots, Feinschliff.
2. Deployment der API (Node 22+, PostgreSQL, `pnpm --filter @pondus/api build && db:migrate:prod && db:seed`), Secrets über Infisical.
3. App-Verteilung ohne MacBook: GitHub Actions baut, signiert und lädt nach TestFlight hoch, später optional EAS Update für JS-Hotfixes. Plan in `APP_DISTRIBUTION.md`, Workflow-Entwurf in `.github/workflows/ios-testflight.yml.disabled`.
4. Live Activity für das aktive Workout (Sperrbildschirm, Dynamic Island): Plan in `LIVE_ACTIVITIES.md`.
5. Später: Supersätze als verknüpfte Sätze in der UI, Apple-Health-Export, Lokalisierung EN.
