# Pondus – Live Activities für das aktive Workout

Stand: 25.10.2026. Status: 🟡 Spike abgeschlossen (Abschnitt 7), Umsetzung läuft.

Ziel: Während eines Workouts zeigt iOS auf dem Sperrbildschirm und in der Dynamic Island die aktuelle Übung, den Satzfortschritt, Zielgewicht und Wiederholungen, den letzten Satz, den Pausentimer und die Workout-Dauer. In einer zweiten Stufe lassen sich Sätze direkt vom Sperrbildschirm abhaken und die Pause verlängern oder überspringen.

## 1. Produktumfang

### Inhalte

| Element | Quelle | Beispiel |
| --- | --- | --- |
| Workout-Name | `WorkoutDto.name` | „Push A“ |
| Aktuelle Übung | nächste offene Übung (siehe 4.2) | „Bankdrücken“ |
| Übungsfortschritt | Index unter den nicht übersprungenen Übungen | „Übung 2 von 6“ |
| Satzfortschritt | nächster offener Satz, Aufwärmsätze getrennt gezählt | „Satz 3 von 4“, „Aufwärmen 1 von 2“ |
| Ziel für den nächsten Satz | `targetWeightGrams`/`targetReps`, sonst Satzwerte, sonst Vorwerte | „80 kg × 8“ |
| Letzter Satz | zuletzt abgehakter Satz dieser Übung | „Zuletzt 80 kg × 8 · RIR 2“ |
| Pausentimer | `rest-timer-store` (`endsAt`, `durationSeconds`) | Countdown „1:24“ + Fortschrittsbalken |
| Workout-Dauer | `startedAt` minus Pausen | „32:10“, zählt selbständig hoch |
| Gesamtfortschritt | erledigte Arbeitssätze / geplante Arbeitssätze | „11 / 22 Sätze“ |
| Zustand | `in_progress`, `paused`, Pause läuft, Pause vorbei, alle Sätze erledigt | „Workout pausiert“ |

Gewichte werden mit der Einheit aus den Einstellungen formatiert (kg/lb). Bei unterstützten Übungen (`loadType = "assisted"`) steht die Unterstützung dabei, zum Beispiel „−20 kg Unterstützung × 8“. Bei Körpergewicht ohne Last nur „× 12“.

### Interaktion

- **Stufe 1 (MVP):** reine Anzeige. Antippen öffnet die App per Deep Link `pondus://workout/<id>`.
- **Stufe 2:** Buttons auf dem Sperrbildschirm und in der erweiterten Dynamic Island. Beschriftung wie im Pausentimer der App:
  - **„Satz ✓“** hakt den nächsten offenen Satz mit den vorgeschlagenen Werten ab und startet die Pause, genau wie der große Button im Workout-Screen.
  - **„−15 s“** und **„+15 s“** verkürzen oder verlängern die laufende Pause.
  - **„Fertig“** beendet die Pause sofort (VoiceOver: „Pause beenden“).
  - **RIR-Abfrage:** Nach „Satz ✓“ erscheint wie in der App eine Reihe mit **„0“, „1“, „2“, „3“, „4+“**. Ein Tap speichert die Wiederholungen in Reserve für genau diesen Satz. Die Abfrage ist optional und verschwindet, sobald sie beantwortet ist oder der nächste Satz abgehakt wird. Für Aufwärmsätze und Sätze bis zum Versagen gibt es keine Abfrage, wie in der App.
- Gewicht und Wiederholungen ändern bleibt in der App. Live Activities erlauben keine Texteingabe, und Stepper auf dem Sperrbildschirm wären fehleranfällig.

### Bewusst nicht im Umfang

- Push-Updates über APNs. Alles startet und ändert sich lokal in der App. Timer laufen ohne Updates (siehe 3.3).
- AlarmKit-Alarm zum Pausenende. Die bestehende lokale Notification reicht vorerst (siehe 9).
- Android. Die App ist iOS-only.
- Home-Screen-Widgets. Die gleiche Technik würde sie später ermöglichen.

### Vorbild

Hevy deckt genau diesen Umfang ab: Pausentimer mit ±15 s und Überspringen, nächste Übung, Satzfortschritt, Zielwerte und Abhaken vom Sperrbildschirm. Fitbod und StrongLifts zeigen nur an, ohne Buttons.

## 2. Technische Entscheidung

| Entscheidung | Gewählt | Alternativen | Begründung |
| --- | --- | --- | --- |
| Widget Extension + Live Activity | **`expo-widgets`** (offizielles Expo-Modul, stabil seit SDK 56, aktuell 58.0.x) | `@bacons/apple-targets` mit eigenem Swift; Voltra (Callstack); `expo-live-activity` (archiviert seit 06/2026) | Versioniert mit unserem SDK, funktioniert mit CNG und EAS-Credentials, UI bleibt in TypeScript (`@expo/ui/swift-ui`, wird zu SwiftUI). Deckt alle Anzeige-Anforderungen ab, inklusive Timer ohne Updates. |
| Timer-Darstellung | `Text` mit `timerInterval`/`countsDown`/`pauseTime` und `ProgressView` mit `timerInterval` | Updates im Sekundentakt | iOS rendert die Zeit selbst. Eine suspendierte App kann ohnehin keine Updates senden. |
| Updates | nur lokal aus der App (`instance.update`) | APNs-Push | Kein Server-Push nötig, keine APNs-Schlüssel, keine Budgets. |
| Fallback | entfällt | `@bacons/apple-targets` + eigene Swift-`LiveActivityIntent`s | Der Spike bestätigt Weg 1: Taps kommen bei App im Hintergrund und bei gesperrtem iPhone an. Nur der erste Tap nach dem Beenden der App geht verloren (siehe 7). |

Die Entscheidung steht auch in TECHNICAL_DECISIONS.md.

### Was `expo-widgets` mitbringt (SDK 58)

- `createLiveActivity(name, Component)` liefert eine Factory mit `start(props, url?, staleDate?)` und `getInstances()`.
- Instanzen haben `update(props, staleDate?)`, `end(dismissalPolicy?, props?, contentDate?)`, `getId()` und Push-Token-Methoden.
- Layout-Regionen: `banner` (Sperrbildschirm), `bannerSmall` (Apple Watch Smart Stack, CarPlay), `compactLeading`, `compactTrailing`, `minimal`, `expandedLeading`, `expandedCenter`, `expandedTrailing`, `expandedBottom`.
- Kontext in der Komponente: `isStale`, `activityFamily`, `isLuminanceReduced`, `colorScheme`, `levelOfDetail`.
- Config-Plugin setzt `NSSupportsLiveActivities`, legt die App Group `group.app.pondus.ios` für App und Extension an und meldet die Extension für EAS an. Optionen: `groupIdentifier`, `frequentUpdates`, `enablePushNotifications` (bleibt aus).
- Mindestversion der Extension: iOS 16.4. Nicht in Expo Go, nur im Dev-Build.

### Einschränkungen der Widget-Komponente

Die mit `'widget'` markierte Funktion läuft in einer eigenen JS-Engine in der Extension. Daraus folgt:

- Keine Hooks, kein State, kein Context, kein `async`, keine Imports und keine Modul-Konstanten.
- Keine React-Native-Komponenten und kein Design-System, nur `@expo/ui/swift-ui`.
- Alle Texte kommen fertig formatiert und übersetzt als Props an. Formatierung und Logik bleiben in der App.
- Nur Systemschrift und SF Symbols. Bilder nur über `widgetsDirectory`; Übungsbilder lassen wir weg.
- Speicher der Extension ist knapp (Größenordnung 30 bis 50 MB). Layout und Props klein halten.

## 3. ActivityKit-Rahmenbedingungen

### 3.1 Lebenszyklus

- Starten nur, solange die App im Vordergrund ist. Das passt: ein Workout startet immer in der App.
- Maximal 8 Stunden aktiv, danach beendet iOS die Activity. Danach bleibt sie bis zu 4 Stunden auf dem Sperrbildschirm.
- Beenden mit `dismissalPolicy`: `.immediate` beim Abbrechen, `.after(+15 min)` nach Abschluss, damit die Zusammenfassung kurz stehen bleibt.
- Nutzer können Live Activities pro App abschalten. Bei der ersten Activity fragt iOS einmalig auf dem Sperrbildschirm „Live-Aktivitäten von Pondus erlauben?“ (im Spike gesehen).

### 3.2 Updates im Hintergrund

Eine suspendierte App führt keinen Code aus und kann die Activity nicht aktualisieren. Der Eintrag `UIBackgroundModes: audio` in `app.json` hilft nicht, weil die App kein Audio abspielt. Daraus folgt das Grundprinzip des Designs:

**Jeder Zustand muss so in die Props geschrieben werden, dass er ohne weiteres Update korrekt weiterläuft.** Das heißt absolute Zeitpunkte statt Restzeiten, und `staleDate` für den Übergang zum Pausenende.

Ausnahme: Buttons in Stufe 2 laufen als `LiveActivityIntent` im App-Prozess. iOS weckt die App dafür kurz auf, sodass sie die Activity aktualisieren kann.

### 3.3 Timer ohne Updates

- **Pause:** `Text(timerInterval: restStartedAt...restEndsAt, countsDown: true)` plus `ProgressView(timerInterval:)`. Der Countdown bleibt bei 0:00 stehen.
- **Workout-Dauer:** `Text(timerInterval: effectiveStart...effectiveStart+12h)` zählt hoch. `effectiveStart` ist `startedAt + pausedSeconds`. Bei pausiertem Workout friert `pauseTime` die Anzeige ein.
- **Pausenende:** `staleDate = restEndsAt`. Ist `isStale` gesetzt, zeigt die Komponente „Pause vorbei · Weiter mit Satz 3“. Laut Forenberichten feuert `staleDate` teils verspätet und erst ab etwa 2 Minuten Abstand. Deshalb gilt:
  - Der Countdown bei 0:00 ist das verlässliche Signal.
  - Die bestehende lokale Notification „Pause vorbei“ bleibt der Alarm.
  - Kommt die App in den Vordergrund, schreibt sie den korrekten Zustand sofort.

### 3.4 Grenzen

- Props höchstens 4 KB. Unsere Props liegen bei geschätzt unter 1 KB.
- Lokale Updates haben kein dokumentiertes Budget, aber ein `isActivityUpdateReduced`-Flag. Wir aktualisieren nur bei echten Zustandsänderungen und nie im Sekundentakt.
- Buttons funktionieren ab iOS 17 und nicht in CarPlay.

## 4. Architektur in der App

```
active-workout-store ─┐
rest-timer-store ─────┼─► buildWorkoutActivityProps() ─► live-activity-controller ─► expo-widgets
settings-store ───────┘        (pur, getestet)               (start/update/end, Diff)      │
                                                                                            ▼
                                                                         WorkoutActivity ('widget')
                                                                                            │ Button-Tap
                                                         handleActivityAction() ◄───────────┘
                                                         (Store-Aktionen, Stufe 2)
```

Neuer Ordner `apps/mobile/src/features/live-activity/`:

| Datei | Inhalt |
| --- | --- |
| `props.ts` | Typ `WorkoutActivityProps` und reine Funktion `buildWorkoutActivityProps(workout, rest, focus, settings, now)` |
| `WorkoutActivity.tsx` | Widget-Komponente mit `'widget'`-Direktive und allen Layout-Regionen |
| `controller.ts` | Abonniert die Stores, startet, aktualisiert und beendet die Activity |
| `actions.ts` | Stufe 2: Button-Events auf Store-Aktionen abbilden |
| `__tests__/props.test.ts` | Unit-Tests für die Props-Ableitung |

### 4.1 Props-Modell

```ts
type WorkoutActivityProps = {
  workoutId: string
  title: string                 // "Push A"
  status: "running" | "paused" | "done"   // done = alle Sätze abgehakt, Workout noch offen
  effectiveStartMs: number      // startedAt + pausedSeconds, für den hochzählenden Timer
  pausedAtMs: number | null     // friert den Dauer-Timer ein
  exercise: {
    name: string                // "Bankdrücken"
    position: string            // "Übung 2 von 6"
    setLabel: string            // "Satz 3 von 4" | "Aufwärmen 1 von 2"
    target: string | null       // "80 kg × 8"
    last: string | null         // "Zuletzt 80 kg × 8 · RIR 2"
  } | null
  next: string | null           // "Als Nächstes: Schrägbankdrücken", wenn die Übung fertig ist
  progress: { done: number; total: number; label: string }   // "11 / 22 Sätze"
  rest: {
    startedAtMs: number
    endsAtMs: number
    pausedRemainingS: number | null   // Pausentimer angehalten
    label: string               // "Pause"
  } | null
  rirPrompt: {                  // Stufe 2: offene RIR-Abfrage für den zuletzt abgehakten Satz
    setId: string
    label: string               // "RIR für Satz 2 · Bankdrücken"
  } | null
  accent: string                // Markenfarbe als Hex
}
```

Alle Strings sind fertig formatiert und auf Deutsch. Die Funktion ist rein und läuft ohne Native-Module, deshalb ist sie mit Jest vollständig testbar.

### 4.2 „Aktuelle Übung“ muss in den Store ✅

Die Live Activity und die Buttons brauchen Fokus, nächsten Satz und offene RIR-Abfrage ohne gemounteten Screen. Umgesetzt in Phase B (25.10.2026):

1. **Fokus und RIR-Abfrage im `active-workout-store`:** `focusedExerciseKey` und `rirPendingSetKey` werden mit dem Workout in `kv` gespeichert (`active_workout_focus`) und bei `hydrate()` wiederhergestellt. Ein anderes Workout beginnt mit leerem Fokus. Der `workout-ui-store` hält nur noch Auswahl, Entwurf und Toast.
2. **`focusedExercise(workout, key)`** in `features/workout/selectors.ts`: die Übung im Fokus, sonst die erste mit offenen Sätzen. Screen, Übersicht und später `buildWorkoutActivityProps` nutzen dieselbe Funktion. Zusammen mit `nextOpenSet()` meinen Anzeige und Button so immer denselben Satz.
3. **`planCompletion()`** (rein, getestet) entscheidet, was beim Abhaken passiert: Werte, Pause, RIR-Abfrage, nächste Übung. Die Store-Aktionen **`completeSet()`** und **`completeNextSet()`** wenden das an: Satz speichern, Pause starten, RIR-Abfrage setzen, optional sofort zur nächsten Übung wechseln (`advanceFocus`, für die Live Activity). Der Screen ergänzt Haptik, Toasts und den verzögerten Übungswechsel.
4. **`setRir(api, setKey, rir)`** speichert den Wert und schließt die Abfrage für diesen Satz.
5. **Pausentimer persistiert:** Jede Änderung landet in `kv` (`rest_timer`). `hydrate()` beim App-Start stellt die Pause wieder her und verwirft eine, die inzwischen abgelaufen ist.

Nebenbei korrigiert: Nach dem letzten offenen Satz des Workouts hielt die Suche nach der nächsten Übung den gerade abgehakten Satz noch für offen. Die Pause lief dann mit „Weiter mit <dieselbe Übung>“ als Benachrichtigungstext. `planCompletion()` schaut mit dem Satz als erledigt voraus und liefert dann `next = null`.

### 4.3 Controller

- **Start:** sobald ein Workout aktiv ist, die App im Vordergrund läuft, die Einstellung an ist und noch keine Instanz existiert. Deep Link `pondus://workout/<id>`.
- **Update:** Store-Abos auf Workout, Fokus und Pausentimer. Props neu bauen, mit den zuletzt gesendeten vergleichen und nur bei Unterschied `update(props, staleDate)` aufrufen. Zusätzlich beim Wechsel in den Vordergrund (`AppState` → `active`) einmal neu schreiben.
- **Ende:**
  - Workout abgeschlossen: Endzustand „Workout beendet · 52 min · 22 Sätze“, `dismissalPolicy` nach 15 Minuten.
  - Workout abgebrochen oder lokal verworfen: sofort beenden.
- **Nach Neustart:** `getInstances()` beim App-Start. Gehört die Instanz zum aktiven Workout, wird sie übernommen und aktualisiert. Sonst wird sie beendet, zum Beispiel wenn das Workout auf dem Server abgeschlossen wurde.
- **Fehlertoleranz:** alle Aufrufe in `try/catch`. Eine fehlende Live Activity darf das Workout nie stören. Sind Activities deaktiviert, wirft `start()` eine Exception (`LiveActivitiesNotSupportedException`). Der Controller fängt sie ab und versucht es erst beim nächsten Workout wieder.
- **Registrierung:** `createLiveActivity()` legt das Layout beim Aufruf in der App Group ab. Das Modul muss deshalb bei jedem App-Start geladen werden, bevor eine Activity startet, also als Import in `app/_layout.tsx`.
- **Einbindung:** einmal in `app/_layout.tsx` nach `hydrate()` starten, ähnlich wie die bestehende Session-Wiederherstellung.

### 4.4 Einstellungen

Neuer Schalter in Profil → Einstellungen: **„Live Activity auf dem Sperrbildschirm“**, Standard an. Ausschalten beendet eine laufende Activity sofort. Den Systemstatus kann `expo-widgets` nicht auslesen, es gibt keine JS-API für `areActivitiesEnabled`. Ist die Funktion systemweit für Pondus aus, erfährt die App das erst über einen fehlgeschlagenen Start. Dann zeigt der Schalter einen Hinweis auf die iOS-Einstellungen.

## 5. Gestaltung

Systemschrift mit tabellarischen Ziffern (`monospacedDigit`) für alle Zahlen. Akzentfarbe `#FF7A1A` für Timer und Fortschritt. Hintergrund über `activityBackgroundTint` und semantische Systemfarben, nicht über `colorScheme`, weil `colorScheme` in Live Activities derzeit immer „light“ meldet (Expo-Issue #47166).

### Sperrbildschirm (`banner`)

Der Spike hat gezeigt: Das Banner hat etwa 160 pt. Wird es höher, beschneidet iOS von der Mitte aus, Kopf- und Fußzeile fallen weg. Das ursprünglich geplante Layout mit eigener Kopfzeile war schon ohne RIR-Abfrage zu hoch. Dieses kompakte Layout passt auf iOS 26.5 (Simulator) und iOS 27.2 (iPhone 15 Pro) in allen Zuständen:

```
┌──────────────────────────────────────────────┐
│ Bankdrücken                            1:24  │
│ Übung 2 von 6 · Satz 3 von 4 · 32:10         │
│ ████████████████████████░░░░░░░░             │
│ 80 kg × 8  ·  Zuletzt 80 kg × 8 · RIR 2      │
│ [ Satz ✓ ]  [ −15 s ]  [ +15 s ]  [ Fertig ] │  ← Stufe 2
└──────────────────────────────────────────────┘
```

Direkt nach „Satz ✓“ mit offener RIR-Abfrage (Stufe 2) ersetzt eine einzeilige RIR-Reihe die Pausen-Buttons:

```
┌──────────────────────────────────────────────┐
│ Bankdrücken                            1:58  │
│ Übung 2 von 6 · Satz 3 von 4 · 33:02         │
│ █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░             │
│ 80 kg × 8  ·  Zuletzt 80 kg × 8 · RIR 2      │
│ RIR  [ 0 ]  [ 1 ]  [ 2 ]  [ 3 ]  [ 4+ ]      │
└──────────────────────────────────────────────┘
```

- **Keine Kopfzeile:** Der Workout-Name steht nicht im Banner. Die Workout-Dauer zählt in der Fortschrittszeile hoch.
- **Countdown rechts oben** in Akzentfarbe, 28 pt. Ohne Pause steht dort „Bereit“, nach Ablauf „Pause vorbei“.
- **Fortschrittsbalken** nur bei laufender Pause. `ProgressView` mit `timerInterval` zeigt sonst zusätzlich die Restzeit als Text, deshalb immer mit `labelsHidden()`.
- **RIR-Abfrage ohne Fragetext**, nur „RIR“ und fünf Buttons. Die Pausen-Buttons fehlen in dieser Zeit, die Pause läuft weiter. Wird die Pause in der App beendet, bevor RIR beantwortet ist, verschwindet die Abfrage, und der Wert bleibt leer wie beim Ignorieren in der App.
- **Ohne laufende Pause** entfällt der Balken, und „Satz ✓“ ist der Hauptbutton. Bei pausiertem Workout steht „Workout pausiert“ statt der Fortschrittszeile, und die Dauer ist eingefroren.
- **Lange Texte** werden einzeilig gekürzt, nicht umgebrochen. Das gilt vor allem für den Übungsnamen.

### Dynamic Island

| Region | Inhalt |
| --- | --- |
| `compactLeading` | Hantel-Symbol + „3/4“ (Satz) |
| `compactTrailing` | Pausen-Countdown in Akzentfarbe, ohne Pause die Workout-Dauer |
| `minimal` | Countdown, sonst Hantel-Symbol |
| `expandedLeading` | Übungsname + kurze Fortschrittsangabe „2/6 · Satz 3/4“. Die Region ist schmal, „Übung 2 von 6 · Satz 3 von 4“ wurde im Spike gekürzt. |
| `expandedTrailing` | Pausen-Countdown groß |
| `expandedCenter` | leer oder Workout-Name |
| `expandedBottom` | Fortschrittsbalken, Ziel und genau eine Button-Reihe (Stufe 2: Pausen-Buttons oder RIR-Reihe). Mehr passt nicht, eine weitere Zeile wurde im Spike abgeschnitten. |

### Apple Watch Smart Stack und CarPlay (`bannerSmall`)

Zwei Zeilen: „Bankdrücken · 3/4“ und der Countdown oder die Dauer. Keine Buttons.

### Timer-Breite

Expo-Issue #51863: Auf iOS 27 erzeugt `timerInterval` zusammen mit `fixedSize` eine NaN-Breite und zerstört das Banner. Ohne `fixedSize` nimmt der Timer die ganze Zeile ein. Wir geben dem Timer stattdessen einen festen `frame(width:)` passend zu „0:00“ bzw. „00:00“. Im Spike funktioniert das auf iOS 26.5 und iOS 27.2 (64 pt für den großen Countdown). `fixedSize` vermeiden wir.

## 6. Konfiguration und Build

- `pnpm --filter @pondus/mobile add expo-widgets @expo/ui` mit `expo install`-kompatiblen Versionen (`~58.0.x`).
- `app.json`: Plugin `["expo-widgets", { "groupIdentifier": "group.app.pondus.ios" }]`. `frequentUpdates` bleibt aus, `enablePushNotifications` bleibt aus.
- Die Live Activity **nicht** in `widgets[]` eintragen, sonst bricht der Build.
- Apple Developer Portal: App Group `group.app.pondus.ios` und die Extension-ID `app.pondus.ios.ExpoWidgetsTarget` müssen existieren. Den ersten EAS-Build interaktiv laufen lassen, damit EAS die Credentials anlegt, und danach im Portal prüfen.
- **Signing ohne EAS:** `xcodebuild -allowProvisioningUpdates` legt die App-ID der Extension an, kann die App Group aber nicht zuweisen. Einmalig in Xcode unter Signing & Capabilities bei beiden Targets die App Group `group.app.pondus.ios` anhaken. Für das Team `XTA9CPY447` ist das seit dem 25.10.2026 erledigt: Die App-ID der Extension existiert, die App Group ist beiden App-IDs zugewiesen.
- **Metro neu starten:** Nach dem Installieren von `expo-widgets` Metro mit `--clear` neu starten. `babel-preset-expo` aktiviert das Plugin für die `'widget'`-Direktive nur, wenn `expo-widgets` beim Start vorhanden ist, und `babel.config.js` cacht die Konfiguration.
- Lokal: `pnpm prebuild` und `pnpm ios` auf dem Mac. Der Raspberry Pi kann keine iOS-Builds. Dort laufen nur Typecheck, Lint und Jest für `apps/mobile`.

## 7. Spike vor der Umsetzung (1 Tag, auf echtem iPhone)

Das größte Risiko sind die Buttons. In `expo-widgets` 58 schickt ein Button-Tap nur ein Event `{ source, target, timestamp }` an `addUserInteractionListener`. Es wird nicht gespeichert und ändert die Props nicht. `source` ist die Activity-ID (im Spike festgestellt, siehe 7.2). Laut Doku feuert der Listener nur, solange der App-Prozess lebt.

Der Spike baut eine minimale Activity mit Timer und einem Button und prüft:

| Fall | Erwartung | Entscheidung |
| --- | --- | --- |
| App im Vordergrund | Event kommt an | – |
| App im Hintergrund, suspendiert | iOS weckt die App, Event kommt an, `update()` wirkt | muss klappen |
| App beendet (aus dem App-Switcher gewischt) | unklar: Event könnte vor dem JS-Start verloren gehen | entscheidet über den Fallback |
| iPhone gesperrt | wie suspendiert | muss klappen |
| iOS 26 und iOS 27 | Timer-Breite korrekt (#51863), Dark Mode lesbar (#47166) | Workarounds festlegen |
| Banner mit RIR-Reihe und Pausen-Buttons | passt in die maximale Höhe | Layout aus Abschnitt 5 bestätigen oder kürzen |
| Mehrere Buttons in einer Reihe (5 × RIR) | jeder Button liefert sein eigenes `target` | Grundlage für die RIR-Abfrage |
| Activities in iOS deaktiviert | Start schlägt still fehl, kein Absturz | Fehlerpfad bestätigt |

**Gehen Taps bei beendeter App verloren**, gibt es zwei Wege:

1. **Akzeptieren und abfedern:** Nach dem Kaltstart zeigt die App die Activity mit dem korrekten Zustand. Ein verlorener Tap fällt sofort auf, weil der Satz nicht abgehakt ist. Da Workouts fast immer mit der App im Hintergrund statt beendet laufen, ist das für Stufe 2 vertretbar.
2. **Fallback auf `@bacons/apple-targets`:** eigene Swift-`LiveActivityIntent`s aktualisieren die Activity direkt, planen die Notification neu und schreiben die Aktion in eine Queue in den App-Group-UserDefaults. Die App arbeitet die Queue beim Start ab. Das kostet geschätzt 3 bis 5 Tage mehr und bringt Swift-Code ins Repo. Eine Mischung beider Ansätze geht nicht, weil der Activity-Datentyp `expo-widgets` gehört.

**Entschieden (25.10.2026): Weg 1.** Seltene verlorene Taps bei beendeter App sind akzeptiert. Der Swift-Fallback kommt nur noch in Frage, wenn der Spike zeigt, dass Taps auch bei suspendierter App oder gesperrtem iPhone verloren gehen.

### 7.1 Befunde aus dem Quellcode (`expo-widgets` 58.0.23)

Vor dem Gerätetest aus dem nativen Code von `expo-widgets` gelesen:

- **Button-Taps:** Ein `Button` in einer Live Activity wird zu einem `LiveActivityIntent` (`LiveActivityUserInteraction`). Er läuft im App-Prozess und schickt nur eine `NotificationCenter`-Nachricht. Der native Observer dafür existiert nur, solange in JS ein Listener hängt (`OnStartObserving`). Bei beendeter App startet iOS die App für den Intent, `perform()` läuft aber vermutlich, bevor JS geladen ist. Der Tap geht dann verloren. Der Gerätetest bestätigt das nur noch.
- **Kein Selbst-Update aus der Extension:** Der Mechanismus, bei dem `onPress` neue Props zurückgibt und die Extension sie ohne App speichert, gilt nur für Home-Screen-Widgets (`WidgetUserInteraction`), nicht für Live Activities.
- **Activities deaktiviert:** `start()` wirft `LiveActivitiesNotSupportedException`, also kein stiller Fehler. Es gibt keine JS-API für `areActivitiesEnabled`. Der Einstellungsschalter (4.4) erfährt den Systemstatus also erst über einen fehlgeschlagenen Start.
- **Layout-Registrierung:** `createLiveActivity()` legt das Layout beim Aufruf in der App Group ab. Das Modul mit dem Aufruf muss deshalb bei jedem App-Start geladen werden, bevor eine Activity startet.
- **Props:** Sie gehen als JSON an die Extension. Zeitpunkte deshalb als Millisekunden übergeben und erst in der Widget-Funktion zu `Date` machen.
- **Widget-Funktion:** Babel macht aus der `'widget'`-Funktion einen String. TypeScript wird entfernt, JSX wird zu `_jsx`, Komponenten und Modifier aus `@expo/ui/swift-ui` sind in der Extension Globals. Template-Literale werden korrekt escaped.
- **iOS 27:** Xcode 26.6 hat keinen iOS-27-Simulator. #51863 lässt sich nur auf einem Gerät mit iOS 27 prüfen.

### 7.2 Ergebnisse (25.10.2026)

Getestet im Simulator (iPhone 17 Pro, iOS 26.5, Dev-Build) und auf einem iPhone 15 Pro mit iOS 27.2 (Release-Build, API auf dem Pi).

| Fall | Simulator | Gerät (iOS 27.2) |
| --- | --- | --- |
| Build | Prebuild und Xcode-Build laufen, die Extension `ExpoWidgetsTarget` wird eingebettet. | Release-Build signiert mit App Group (siehe 6). |
| Start, Update | `update()` dauert 7 bis 80 ms. | `update()` dauert 2 bis 19 ms. |
| Timer ohne Updates | Countdown, Balken und Workout-Dauer laufen weiter, auch bei beendeter App. | ✓ |
| Tap, App im Hintergrund | Kommt 0 bis 4 ms nach dem Tap an, `update()` wirkt. | ✓ auch nach etwa 3 Minuten im Hintergrund, 0 bis 1 ms. |
| Tap auf dem Sperrbildschirm | ✓ | ✓ |
| 5 × RIR | Jeder Button liefert sein eigenes `target` (`rir-0` bis `rir-4`). | ✓ |
| Tap bei beendeter App | **Geht verloren.** iOS startet die App im Hintergrund, das Event kommt nicht an. Der nächste Tap kommt an. | Gleiches Verhalten: `launch [background]` ohne `tap`, der nächste Tap 3 s später kommt an. |
| Schnelle Mehrfach-Taps | – | Drei „−15 s“ innerhalb einer Sekunde kommen als drei Events an. |
| `source` im Event | Die **Activity-ID**, nicht der Name aus `createLiveActivity`. | ✓ |
| Erste Activity | iOS fragt einmalig „Live-Aktivitäten von Pondus erlauben?“. | ✓ |
| Dark Mode | Banner in beiden Modi dunkel und lesbar, `colorScheme` meldet immer „light“ (#47166). | ✓ |
| Banner-Höhe | Das ursprüngliche Layout aus Abschnitt 5 war schon ohne RIR-Reihe zu hoch, iOS beschneidet ab etwa 160 pt von der Mitte aus. Das kompakte Layout (heute Abschnitt 5) passt. | Kompaktes Layout passt, nichts gequetscht. |
| Timer-Breite (#51863) | `frame(width: 64)` korrekt. | `frame(width: 64)` korrekt auf iOS 27.2. `fixedSize` nicht getestet, wir verwenden es nicht. |
| `ProgressView` mit `timerInterval` | Zeigt zusätzlich die Restzeit als Text, `labelsHidden()` entfernt sie. | ✓ |
| Erweiterte Dynamic Island | `expandedBottom` mit einer Zeile mehr als Balken, Ziel und Buttons wird abgeschnitten. `expandedLeading` kürzt lange Fortschrittstexte. | ✓ |

**Nicht getestet:** gesperrtes iPhone über mehr als 5 Minuten (die längste Pause im Test war etwa 3 Minuten) und deaktivierte Live Activities. Für Letzteres ist das Verhalten aus dem Quellcode klar (`start()` wirft, siehe 7.1). Beides kommt in die manuelle QA von Phase C (Abschnitt 10).

**Fazit:** Weg 1 ist bestätigt. `expo-widgets` reicht für Anzeige und Buttons, ein Swift-Fallback ist nicht nötig. Folgen für die Umsetzung:
- Layout nach Abschnitt 5 (kompakt).
- Phase D entprellt nur „Satz ✓“ und RIR, nicht die Pausen-Buttons, weil schnelle Mehrfach-Taps auf „±15 s“ gewollt sind.
- Phase D verwirft Taps, deren `source` nicht zur aktuellen Activity gehört.

### 7.3 Spike-Code

Der Spike liegt auf dem Branch `spike/live-activities` und kommt nicht nach `main`: `src/features/live-activity-spike/` (Layout, Controller mit Log in `kv`) und `src/app/spike/live-activity.tsx` (Debug-Screen, Deep Link `pondus://spike/live-activity`). Er eignet sich als Referenz für Layout-Experimente: Der Debug-Screen schaltet Banner-Variante, Timer-Modus und Timer-Breite um, und das Log übersteht einen Kaltstart.

## 8. Umsetzungsplan

### Phase A – Spike ✅ (25.10.2026)
Ergebnisse in Abschnitt 7. Weg 1 ist bestätigt, das Layout aus Abschnitt 5 wurde auf das kompakte Banner umgestellt.

### Phase B – Refactor des Workout-Zustands ✅ (25.10.2026)
Siehe 4.2. Jest-Tests für `focusedExercise`, `planCompletion` (Werte, Standardpause, Aufwärmsätze ohne Pause und RIR, kein RIR nach Satz bis Versagen, Wechsel zur nächsten Übung, Ende des Workouts) und `restoreRestTimer`. Im Simulator geprüft: Nach dem Beenden und Neustarten der App sind RIR-Abfrage und laufende Pause wieder da.

### Phase C – Live Activity, nur Anzeige ⬜ (2 bis 3 Tage)
- `expo-widgets` und `@expo/ui` installieren (`~58.0.23`), Plugin konfigurieren, Prebuild prüfen, Metro mit `--clear` neu starten.
- `buildWorkoutActivityProps()` mit Tests: laufendes Workout, pausiert, Pause läuft, Pause angehalten, Aufwärmsatz, letzte Übung fertig, alle Sätze fertig, leeres freies Training, übersprungene Übungen, `lb`, unterstützte Übung, Körpergewicht, Props unter 4 KB.
- `WorkoutActivity.tsx` mit allen Regionen aus Abschnitt 5.
- Controller mit Start, Diff-Update, Ende, `getInstances()`-Abgleich und `AppState`-Resync.
- Einstellungsschalter.
- Manuelle QA nach Abschnitt 10.

### Phase D – Buttons und RIR-Abfrage ⬜ (2 bis 2,5 Tage, Weg 1)
- `addUserInteractionListener` in `actions.ts` mit diesen Targets:

  | Target | Aktion |
  | --- | --- |
  | `complete-set` | `completeNextSet()` |
  | `rest-minus-15` | `rest.adjust(-15)` |
  | `rest-plus-15` | `rest.adjust(15)` |
  | `rest-done` | `rest.stop()` |
  | `rir-0` … `rir-4` | `setRir(rirPendingSetId, n)`; „4+“ speichert 4 wie in der App |

- Die bestehende Notification-Logik im Pausentimer plant sich bei `adjust` und `stop` automatisch neu oder bricht ab.
- Der Controller schreibt danach die neuen Props.
- RIR-Taps prüfen, dass `rirPendingSetId` noch zum angezeigten Satz gehört. Ein veralteter Tap nach einem Zustandswechsel wird verworfen.
- Idempotenz: Doppelte Taps auf „Satz ✓“ und RIR innerhalb von 1 Sekunde ignorieren, damit kein Satz doppelt abgehakt wird. „±15 s“ und „Fertig“ nicht entprellen, schnelle Mehrfach-Taps auf „±15 s“ sind gewollt (im Spike beobachtet).
- Taps verwerfen, deren `source` (Activity-ID) nicht zur aktuellen Activity gehört, zum Beispiel von einer veralteten Activity nach einem Absturz.
- Haptik gibt es auf dem Sperrbildschirm nicht. Die Bestätigung ist die sichtbare Änderung der Activity.

### Phase E – Feinschliff und Doku ⬜ (0,5 Tage)
- Endzustand nach Abschluss mit Kurz-Zusammenfassung.
- VoiceOver-Labels für alle Regionen, Dynamic Type bis `xxxLarge` prüfen.
- TECHNICAL_DECISIONS.md, ARCHITECTURE.md und IMPLEMENTATION_PLAN.md aktualisieren.

**Gesamt:** etwa 7 bis 9 Arbeitstage mit Weg 1. Der Spike hat den Fallback nicht nötig gemacht.

## 9. Spätere Erweiterungen

- **AlarmKit (iOS 26+):** ein echter Alarm zum Pausenende, der Stummschaltung und Fokus ignoriert. Er bringt eine eigene, zweite Live Activity mit und braucht Swift-Code. Sinnvoll, falls Nutzer die Notification überhören.
- **Push-Updates:** würden den Wechsel auf „Pause vorbei“ exakt zum Pausenende ermöglichen, auch bei suspendierter App. Dafür bräuchte die API einen APNs-Schlüssel und einen Job pro Pause. Der Nutzen ist gering, solange Countdown und Notification das abdecken.
- **Home-Screen-Widget** „Nächstes Training“ mit derselben Technik.
- **Apple Watch:** eigener Layout-Zweig für `bannerSmall` ist schon vorgesehen; Buttons gibt es dort nicht.

## 10. Testplan

**Automatisiert (Jest, läuft auch auf dem Pi):**
- `buildWorkoutActivityProps` mit allen Fällen aus Phase C.
- `nextOpenSet`, `completeNextSet`, Timer-Persistenz.
- Controller mit gemocktem `expo-widgets`: startet genau einmal, sendet keine Updates ohne Änderung, beendet bei Abschluss und Abbruch, übernimmt oder beendet fremde Instanzen nach dem Start.
- Aktionen: Doppeltap-Schutz, kein Abhaken ohne offenen Satz, `±15 s` ohne laufende Pause tut nichts, RIR-Tap ohne passende offene Abfrage tut nichts.
- Props: RIR-Abfrage nur nach Arbeitssätzen, nicht nach Aufwärmsätzen und Sätzen bis zum Versagen; verschwindet nach Antwort, nach dem nächsten Satz und nach „Fertig“.

**Manuell auf echtem iPhone (iOS 26 und 27):**

| Szenario | Erwartung |
| --- | --- |
| Workout starten, iPhone sperren | Activity erscheint mit Übung, Satz, Ziel und Dauer |
| Satz in der App abhaken, sperren | Pause zählt auf dem Sperrbildschirm herunter, Balken läuft |
| Pause läuft ab, iPhone gesperrt | Countdown steht bei 0:00, Notification kommt, nach `staleDate` „Pause vorbei“ |
| App öffnen nach Pausenende | Activity zeigt sofort den nächsten Satz ohne Pause |
| Workout pausieren | Dauer friert ein, Hinweis „Workout pausiert“ |
| Letzten Satz einer Übung abhaken | „Als Nächstes: …“ erscheint |
| Workout abschließen | Endzustand, verschwindet nach 15 Minuten |
| Workout abbrechen | Activity verschwindet sofort |
| App beenden, neu starten | Activity wird übernommen, kein Duplikat |
| Schalter in Einstellungen aus | Activity endet sofort, startet nicht neu |
| Dark Mode, Always-On-Display | lesbar, `isLuminanceReduced` gedimmt |
| Dynamic Island compact, minimal, expanded | Inhalte nach Abschnitt 5 |
| Stufe 2: „Satz ✓“ bei suspendierter App | Satz in der App abgehakt, Pause startet, Activity aktualisiert |
| Stufe 2: „−15 s“, „+15 s“, „Fertig“ | Countdown und Notification passen sich an |
| Stufe 2: Doppeltap auf „Satz ✓“ | nur ein Satz abgehakt |
| Stufe 2: „Satz ✓“, dann RIR „2“ | RIR 2 am richtigen Satz, in der App sichtbar, Abfrage verschwindet |
| Stufe 2: RIR in der App beantworten | Abfrage verschwindet auch auf dem Sperrbildschirm |
| Stufe 2: Aufwärmsatz oder Satz bis Versagen abhaken | keine RIR-Abfrage |

## 11. Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Erster Button-Tap nach dem Beenden der App geht verloren (im Spike bestätigt) | Satz wird nicht abgehakt | akzeptiert (Weg 1). Der fehlende Haken fällt sofort auf, ein zweiter Tap funktioniert. |
| Timer-Breite auf iOS 27 (#51863) | Banner zerstört | fester `frame(width:)`, im Spike auf iOS 27.2 bestätigt; kein `fixedSize` |
| `colorScheme` immer „light“ (#47166) | falsche Farben im Dark Mode | nur semantische Systemfarben |
| `staleDate` feuert verspätet | „Pause vorbei“ erscheint zu spät | Countdown bei 0:00 und Notification sind das primäre Signal |
| Speichergrenze der Extension | Activity wird nicht angezeigt | kleines Layout, keine Bilder |
| Banner zu hoch (Grenze etwa 160 pt) | iOS schneidet Kopf- und Fußzeile ab | kompaktes Layout aus Abschnitt 5, im Spike auf iOS 26.5 und 27.2 bestätigt; neue Zeilen nur nach Test auf dem Gerät |
| Workout länger als 8 Stunden | Activity endet von selbst | akzeptiert |
| App Group fehlt im Provisioning-Profil | Build- oder Signierfehler | für Team `XTA9CPY447` erledigt (siehe 6); bei neuen Teams einmalig in Xcode oder im Developer Portal zuweisen |

## 12. Entscheidungen (25.10.2026)

1. **Pausen-Buttons wie in der App:** „−15 s“, „+15 s“ und „Fertig“.
2. **RIR wird auf dem Sperrbildschirm abgefragt:** nach „Satz ✓“ mit den Buttons „0“ bis „4+“, nach denselben Regeln wie in der App.
3. **Weg 1:** Seltene verlorene Taps bei beendeter App sind akzeptiert, kein Swift-Fallback von Anfang an.
4. **Standardmäßig an,** mit Schalter in den Einstellungen.

## Quellen

- Expo: [expo-widgets Doku (SDK 58)](https://docs.expo.dev/versions/latest/sdk/widgets/), [Blog: iOS widgets and Live Activities in Expo](https://expo.dev/blog/ios-widgets-and-live-activities-in-expo), [@expo/ui Text](https://docs.expo.dev/versions/v58.0.0/sdk/ui/swift-ui/text/), [Issue #51863](https://github.com/expo/expo/issues/51863), [Issue #47166](https://github.com/expo/expo/issues/47166)
- Apple: [Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities), [ActivityKit Push](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications), [Adding interactivity to widgets and Live Activities](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities), [AlarmKit](https://developer.apple.com/documentation/alarmkit/scheduling-an-alarm-with-alarmkit)
- Alternativen: [@bacons/apple-targets](https://github.com/EvanBacon/expo-apple-targets), [Voltra](https://github.com/callstackincubator/voltra), [expo-live-activity (archiviert)](https://github.com/software-mansion-labs/expo-live-activity)
- Wettbewerb: [Hevy Live Activity](https://www.hevyapp.com/features/live-activity/), [Fitbod Widget](https://help.fitbod.me/hc/en-us/articles/360058341233-iOS-Widget), [StrongLifts](https://support.stronglifts.com/article/126-apple-live-activities-and-dynamic-island)
