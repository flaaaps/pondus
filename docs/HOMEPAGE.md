# Pondus – Marketing-Homepage

Stand: 25.10.2026. Status: 🟡 erster Entwurf live auf GitHub Pages, Rechtstexte und eigene Domain offen.

Ziel: Eine ruhige, präzise Seite, die in einer Minute erklärt, was Pondus anders macht, und mit echten Screenshots zeigt, wie sich die App anfühlt. Tonalität und Farben nach BRAND_IDENTITY.md.

## Entscheidungen (25.10.2026)

| Frage | Entscheidung |
| --- | --- |
| Call to Action | „Bald im App Store“, ohne Formular und ohne Backend |
| Preis | Kein Preisabschnitt, keine Aussagen zum Preis |
| Technik | Astro, rein statisch, neues Paket `apps/web` |
| Hosting | GitHub Pages über Actions (`.github/workflows/web.yml`), vorerst unter https://flaaaps.github.io/pondus/ |
| Sprache | Nur Deutsch, Du-Form |

## Struktur

1. **Kopfzeile:** Wortmarke, Ankerlinks (Funktionen, So geht’s, Prinzipien, FAQ), Badge „Bald im App Store“.
2. **Hero:** Claim „Dein Training. Dein Gewicht. Dein Fortschritt.“, ein Satz darunter: Pondus plant dein Krafttraining, protokolliert jeden Satz in Sekunden und sagt dir nachvollziehbar, wann du steigerst. Badge. Zwei iPhones: Workout-Screen vorne, Wochenplan dahinter.
3. **Drei Belege in einer Zeile:** Plan in einer Minute · Funktioniert offline · Jede Empfehlung erklärt sich.
4. **Abgrenzung:** Logbücher sind schnell, aber planen nicht. Programm-Apps planen, brechen aber bei jeder Alltagsänderung. Pondus verbindet beides.
5. **Funktionen**, abwechselnd Bild links/rechts:
   1. *Ein Plan, der mitgeht:* Profil → Plan, Wochenansicht, Einheiten verschieben, Übungen tauschen, „Warum so?“.
   2. *Schnell im Training:* Fokus-Ansicht mit einem Satz, großer Haken, Pausentimer, offline.
   3. *Auf dem Sperrbildschirm:* Live Activity mit Pause, Satz abhaken, RIR.
   4. *Progression, die sich erklärt:* Ziel-Badge „↑ +2,5 kg“, Doppelprogression in einem Satz erklärt.
   5. *Fortschritt sehen:* Wochenvolumen, Muskelverteilung, Rekorde, Übungsverlauf.
6. **So geht’s:** drei Schritte (Profil in acht Fragen → Plan → Trainieren und steigern).
7. **Prinzipien:** Keine KI-Blackbox · Kein Konfetti, keine Feeds · Lokal zuerst · Deine Daten (Export, Konto löschen).
8. **FAQ:** Für wen? Ohne Vorwissen? Ohne Internet? Eigene Übungen? Android, Apple Watch? Was passiert mit meinen Daten?
9. **Abschluss:** Claim, Badge „Bald im App Store“.
10. **Fußzeile:** Impressum, Datenschutz (Platzhalter, Inhalte müssen vor dem Livegang ergänzt werden).

## Screenshots

Aus einem Release-Build im Simulator (iPhone 17 Pro, iOS 26.5), damit kein Dev-Menü sichtbar ist. Statusleiste per `xcrun simctl status_bar` auf 18:30, volle Batterie, volles Netz. Den Sperrbildschirm mit echter Uhrzeit aufnehmen: Mit `--time` zeigt iOS dort sonst „1. Jan.“.

Daten aus einem Demo-Konto mit sechs Wochen Historie, erzeugt über die echte API, damit Ziele, Empfehlungen und Rekorde aus der echten Logik stammen:

```sh
DEMO_API_URL=http://127.0.0.1:4010 pnpm --filter @pondus/api db:create-demo-account
```

Konto `demo@pondus.local` / `pondus-demo-1234` („Alex“, Muskelaufbau, 4× pro Woche, Fokus Brust und Rücken). Trainiert wird So, Mo, Mi und Fr nach Doppelprogression; heute ist „Oberkörper A“ offen. Das Skript löscht ein vorhandenes Demo-Konto und verweigert den Pi und Produktions-Domains.

Ablauf: App mit `EXPO_PUBLIC_API_URL=http://127.0.0.1:4010` als Release für den Simulator bauen (`ARCHS=arm64` spart die x86-Hälfte), Demo-Konto anmelden, Passwort-Dialog mit „Später“ schließen, dann die Screens unten aufnehmen.

| Datei | Inhalt | Abschnitt |
| --- | --- | --- |
| `workout.png` | Fokus-Ansicht, Satz mit Ziel „↑ +2,5 kg“ | Hero, Schnell im Training |
| `workout-rest.png` | Pausentimer im Dock und RIR-Abfrage | Schnell im Training |
| `today.png` | Startseite mit nächstem Training | So geht’s |
| `plan-week.png` | Wochenansicht des Plans | Hero, Plan |
| `plan-why.png` | „Warum so?“ | Plan, Progression |
| `lock-screen.png` | Live Activity auf dem Sperrbildschirm | Sperrbildschirm |
| `progress.png` | Fortschritt: Wochenvolumen und Muskelverteilung | Fortschritt |
| `exercise.png` | Übungsverlauf mit Trend und Empfehlung | Progression, Fortschritt |
| `records.png` | Bestleistungen | Fortschritt |

Die Seite zeigt die Screenshots in einem schlichten iPhone-Rahmen aus CSS, ohne fremde Mockup-Assets.

## Umsetzung

- Deployment: Jeder Push auf `main`, der `apps/web` betrifft, baut und veröffentlicht die Seite; manuell über „Run workflow“ (`workflow_dispatch`). Der Build installiert nur `@pondus/web`.
- `apps/web`: Astro 6.4 (Astro 7 braucht Node ≥ 22.23), rein statisch, kein Client-JS. `pnpm --filter @pondus/web dev | build | preview | typecheck`.
- Komponenten: `Header`, `Footer`, `Mark`, `Phone` (CSS-Rahmen, WebP über `astro:assets` und `sharp`), `StoreBadge`, `LegalPage`.
- Farben und Abstände als CSS-Variablen aus der Marke, Systemschrift, Dark Mode über `prefers-color-scheme`.
- Geprüft im Browser bei 1440 px und 390 px, hell und dunkel; `astro check` ohne Befund. Lighthouse steht noch aus.

### Beim Aufnehmen gefunden und in der App behoben

- Gewichte erschienen mit Punkt („92.5 kg“) statt Komma. `formatWeight` in `lib/format.ts` setzt jetzt überall das deutsche Komma, auch in Diagrammen, Empfehlungs- und Plan-Begründungstexten.
- Geschätzte 1RM-Werte mit zwei Nachkommastellen („93,33“) werden auf 100 g gerundet.
- Plan-Begründung: „Brust, Rücken bekommen …“ heißt jetzt „Brust und Rücken bekommen …“, mit Singular bei einem Fokusmuskel.
- Die Wochenliste im Plan war nach Plan-Reihenfolge sortiert, jetzt nach Datum.
- Beim Abmelden blieb das laufende Workout des alten Kontos im Speicher und wurde für das nächste Konto wieder gespeichert. Abmelden leert jetzt Workout, Pausentimer und Workout-Ansicht.

## Offen

- Eigene Domain. Dann in den Pages-Einstellungen eintragen; der Workflow übergibt Origin und Base-Pfad an Astro (`PONDUS_WEB_SITE`, `PONDUS_WEB_BASE`), Links laufen über `src/lib/url.ts`.
- Impressum und Datenschutzerklärung (Inhalte vom Betreiber).
- App-Store-Link und offizielles Badge, sobald die App live ist (das Apple-Badge darf erst mit echtem Link verwendet werden; bis dahin ein eigenes, neutrales Badge).
