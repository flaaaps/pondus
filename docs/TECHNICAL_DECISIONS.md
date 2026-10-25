# Pondus – Technische Entscheidungen

Jede Entscheidung mit Kontext, Alternativen und Begründung. Stand: 25.10.2026.

## Repository

**Eigenständiges pnpm-Workspace-Monorepo** (`packages/shared`, `apps/api`, `apps/mobile`) statt Integration in das benachbarte StudyPilot-Monorepo. Begründung: anderes Produkt, anderer Stack (StudyPilot: NestJS/Capacitor/Nx), keine gemeinsame Infrastruktur; das Nx-Monorepo würde auf dem Raspberry Pi unnötig schwere Builds erzwingen. Übernommen wurden Konventionen: pnpm, Drizzle, Prettier-Stil (ohne Semikolons, doppelte Anführungszeichen).

## Mobile

| Entscheidung | Gewählt | Alternativen | Begründung |
| --- | --- | --- | --- |
| Framework | **Expo SDK 58** (RN 0.88, New Architecture) mit Continuous Native Generation (`expo prebuild`) | Bare RN | Expo liefert native Tabs, Liquid Glass, SQLite, SecureStore, Haptics, Notifications als gepflegte Module; `ios/` wird generiert, nicht eingecheckt. Dev-Build (`expo-dev-client`) statt Expo Go wegen nativer Module. |
| Navigation | **Expo Router** mit `expo-router/native-tabs` (UITabBarController) und nativen Stacks | React Navigation direkt | Dateibasiert, typed routes, echte UIKit-Tab-Bar inkl. Liquid Glass auf iOS 26 und `minimizeBehavior`. Einschränkung: Tabs können nicht dynamisch hinzugefügt werden – nicht benötigt. |
| Liquid Glass | **`expo-glass-effect`** (`GlassView`) mit `isLiquidGlassAvailable()`-Check und `expo-blur`-Fallback; nur für schwebende Controls | Hacks mit halbtransparenten Views | Native API, dokumentierter Fallback, kein Over-Use. |
| Server-State | **TanStack Query v5** + `react-query-persist-client` (AsyncStorage) | SWR, Redux Toolkit Query | Caching, Invalidierung, Persistenz für Offline-Lesen; keine zweite Store-Lösung für Serverdaten. |
| Lokaler State | **zustand** (Session, Settings, aktives Workout, Pausentimer, Picker) | Redux, Jotai | Minimal, ohne Boilerplate, gut testbar; nur dort, wo Zustand wirklich global ist. |
| Lokale Datenbank | **expo-sqlite** (synchron, WAL) für `kv` (aktives Workout) und `outbox` | WatermelonDB, MMKV, AsyncStorage | Transaktionen und Reihenfolge für die Outbox; synchroner Zugriff vor dem ersten Render; keine ORM-Komplexität für zwei Tabellen. |
| Tokens | **expo-secure-store** (Keychain, `AFTER_FIRST_UNLOCK`) | AsyncStorage | Sicherheit; AsyncStorage nur für unkritische Einstellungen und Query-Cache. |
| Animationen | **react-native-reanimated 4** (+ worklets) | Animated API | Standard bei Expo 58, UI-Thread-Animationen; sparsam eingesetzt (Button-Spring, Skeleton). |
| Diagramme | **Eigene SVG-Charts** mit `react-native-svg` | victory-native (Skia), react-native-chart-kit | Victory 43 bräuchte Skia (schwer, Build-Zeit); unsere Anforderungen (Balken, Linie, Tap) sind klein. Volle Kontrolle über Lesbarkeit und Tokens. |
| Haptik | **expo-haptics** über eine `haptic()`-Hilfsfunktion | – | Zentral, fehlertolerant (Simulator). |
| Formulare | **Kontrollierte Komponenten + zod-Schemas aus `@pondus/shared`** | react-hook-form | Wenige Formulare, meist Chips/Stepper; eine Formularbibliothek brächte mehr Gewicht als Nutzen. |
| Tastatur | **react-native-keyboard-controller** | KeyboardAvoidingView | Zuverlässiges Scrollen der aktiven Satzzeile über die Tastatur. |
| Pausentimer | Wall-Clock-`endsAt` + lokale Notification (`expo-notifications`) | setInterval-Countdown | Übersteht Hintergrund/App-Wechsel; UI tickt nur fürs Rendern. Audio-Background-Mode ist in `app.json` für künftige Timer-Sounds eingetragen. |
| Offline-Strategie | **Lokal-first mit Outbox** (siehe ARCHITECTURE.md) | Generischer Sync-Layer (Watermelon/Replicache) | Umfang der ersten Version: nur Workout-Schreibpfade müssen offline funktionieren; Lesepfade via Query-Cache. Deterministische Konfliktregeln statt „last write wins“. |
| IDs | `expo-crypto.randomUUID()` für Client-IDs | uuid-Paket | Nativ, kein Polyfill. |
| Live Activities | **`expo-widgets` + `@expo/ui`** (SDK 58), Layout in TypeScript mit `'widget'`-Direktive, Updates nur lokal aus der App | `@bacons/apple-targets` mit eigenem Swift, Voltra, APNs-Push | Versioniert mit dem SDK, funktioniert mit CNG. Spike vom 25.10.2026 auf iOS 26.5 und 27.2: Timer laufen ohne Updates, Button-Taps kommen bei App im Hintergrund und auf dem Sperrbildschirm in Millisekunden an. Nur der erste Tap nach dem Beenden der App geht verloren, das ist akzeptiert. Details in LIVE_ACTIVITIES.md. |

## Backend

| Entscheidung | Gewählt | Alternativen | Begründung |
| --- | --- | --- | --- |
| Framework | **Fastify 5** mit `fastify-type-provider-zod` | Express, NestJS | Vorgabe; zod-Schemas aus `shared` dienen zugleich Validierung, Typisierung und OpenAPI. |
| ORM | **Drizzle ORM 0.44** + `drizzle-kit` | Prisma | SQL-nah, leichter Prozess (kein Engine-Binary auf ARM), Migrationen als lesbares SQL, bereits im Umfeld genutzt. |
| Passwörter | **Argon2id** (`@node-rs/argon2`, prebuilt arm64) | bcrypt | Aktuelle Empfehlung, keine eigene Kryptografie. |
| Sessions | **JWT-Access (15 min) + opakes Refresh-Token mit Rotation und 60-s-Toleranzfenster** (`replaced_by_id`) | Sitzungs-Cookies, lange JWTs, strikte Rotation | Mobil-typisch, Widerruf möglich (Hash in DB), kurzer Blast-Radius. Strikte Rotation hat im Gym ausgeloggt: Antwort auf den Refresh ging verloren, der alte Token war serverseitig schon widerrufen. Im Fenster darf der alte Token einmal nachgereicht werden; das verpasste Paar wird dabei zurückgezogen, es bleibt genau ein gültiges. Der Client hält das Paar zusätzlich im Speicher, falls die Keychain-Schreibung (App im Hintergrund geweckt, iPhone gesperrt) fehlschlägt. Läuft die Sitzung trotzdem ab, bleiben Workout und Outbox lokal erhalten, bis sich ein anderes Konto anmeldet; nach dem Login wird ein auf dem Server offenes Workout übernommen. |
| Gewichte | **Integer-Gramm** | numeric(6,2), Gleitkomma | Keine Rundungsfehler, exakte Umrechnung in lb, einfache Arithmetik für Volumen. |
| Planversionierung | **Unveränderliche Versionen + Snapshots im Workout** | Mutable Plan + Audit-Log | Historie bleibt korrekt darstellbar; Diff und Rollback trivial. |
| Kalender | **Template-Wochentage + Overrides pro Woche** (`session_overrides`) | Konkrete Termine für jede Woche materialisieren | Keine Generierungsläufe, keine verwaisten Termine; „diese Woche verschieben“ bleibt von „dauerhaft verschieben“ getrennt. |
| Idempotenz | Fachliche Client-IDs + optionaler `Idempotency-Key` | Nur eines von beiden | Sync-Batches brauchen stabile Client-IDs; einzelne REST-Writes profitieren vom Header. |
| Suche | In-Memory-Filter über die Bibliothek (< 1000 Zeilen) | pg_trgm / Volltext | Einfach, schnell genug, unabhängig von Extensions; Wechsel möglich, wenn die Bibliothek wächst. |
| Tests | **Vitest** + **embedded-postgres** (echtes PostgreSQL 17 im Test-Setup) | pg-mem, Mocks | Echte SQL-Semantik (Constraints, Transaktionen) ohne Docker/Root – wichtig auf dem Entwicklungs-Pi. |
| Build | esbuild-Bundle (`build.mjs`) inkl. `@pondus/shared`, npm-Abhängigkeiten extern | tsc-Build mit Projektreferenzen | Ein Artefakt pro Entry, Workspace-Paket ohne separaten Build. |

## Bewusste Vereinfachungen

- Kein LLM/externer KI-Dienst; Planung ist regelbasiert und getestet.
- Keine Mehrgeräte-Live-Synchronisation (Pull bei App-Start/Foreground genügt).
- UI-Sprache Deutsch; Datenmodell zweisprachig vorbereitet.
- Kalorien werden bewusst nicht berechnet.
