# Pondus – Design System

Quelle der Wahrheit: `apps/mobile/src/design-system/tokens.ts` (Tokens) und `apps/mobile/src/design-system/components/*` (Komponenten). Screens verwenden ausschließlich Tokens über `useTheme()`; keine hartkodierten Farben oder Abstände.

## Tokens

- **Farben:** semantische Schlüssel (`background`, `surface`, `surfaceMuted`, `surfaceStrong`, `border`, `textPrimary/Secondary/Tertiary/Inverse`, `accent`, `accentSoft`, `success`, `warning`, `danger`, `chart*`, `glassTint`). Light/Dark als zwei vollständige Paletten, umgeschaltet über `ThemeProvider` (System, Hell, Dunkel wählbar im Profil).
- **Abstände:** 4-pt-Raster `space[0..10]` = 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Radien:** xs 6, sm 10, md 14, lg 20, xl 28, pill.
- **Typografie:** siehe Brand Identity; `numeral`/`numeralLarge` mit tabellarischen Ziffern. Alle Texte skalieren mit Dynamic Type bis Faktor 1,4 (`maxFontSizeMultiplier`), damit Layouts nicht brechen.
- **Schatten:** sm/md/lg – nur für schwebende Elemente.
- **Motion:** fast 160 ms, base 240 ms, slow 360 ms; Spring-Presets für Tap-Feedback (Reanimated).
- **Größen:** Touch-Ziel 44 pt, Button 52/40, Input 52.

## Komponenten

| Komponente | Zweck | Zustände |
| --- | --- | --- |
| `Text` | Typografie-Varianten + semantische Farben | – |
| `Button` | primary / secondary / ghost / danger / glass; md/sm; Haptik beim Tap; Scale-Spring | loading, disabled |
| `Card` | Inhaltsfläche; tones surface/muted/accent/strong; optional pressable | pressed |
| `GlassSurface` | Liquid Glass (iOS 26+) mit Blur-Fallback; nur für schwebende Controls | – |
| `Input` | Textfeld mit Label, Fehler, Hinweis, Fokusrahmen | focused, error |
| `NumberField` | Direkt editierbare Zahl mit ±-Steppern (Gewicht, Wiederholungen, Sätze) | compact |
| `Chip` | Auswahl/Filter/Status; tones | selected |
| `ListRow` | iOS-Inset-Zeile mit Leading/Trailing/Value/Chevron | pressed |
| `EmptyState`, `ErrorState`, `LoadingState`, `Skeleton` | konsistente Lade-/Leer-/Fehlerzustände | – |
| `SegmentedControl` | Wechsel zwischen Ansichten/Metriken | – |
| `ProgressBar`, `ProgressRing` | Fortschritt (Onboarding, Timer) | – |
| `BarChart`, `LineChart` | SVG-Diagramme ohne Zusatzbibliothek, antippbar, mit Leerzustand | selected |
| `Screen`, `Section` | Screen-Grundgerüst mit Large Title, Safe Areas, Gutter, Abschnittsüberschriften | – |
| `Stat` | Kennzahl mit Label und Einheit | – |
| `BigStepper` | Großer Zahlen-Stepper fürs Workout: 64-pt-±, Halten wiederholt (beschleunigt), Zahl antippen zum Tippen, eine „adjustable“-Einheit für VoiceOver | compact, emphasis missing |

Feature-spezifische Komponenten (`src/components`): Workout unter `components/workout` (`WorkoutTopBar`, `ExerciseHeader`, `SetEditor`, `SetList`, `WorkoutDock` mit Pausentimer, `ContextCards`), `ActiveWorkoutBanner`, `ExerciseList` (Suche/Filter), `ExercisePreferenceRow`, `OnboardingShell`, `BrandMark`.

## Zentrale UI-Entscheidungen

1. **Native Tab-Bar** über `expo-router/native-tabs` (UITabBarController): Liquid Glass auf iOS 26, Material darunter, `minimizeBehavior="onScrollDown"`. Farben über `DynamicColorIOS`, weil die native Bar auf JS-Theme-Wechsel nicht reagiert.
2. **Native Stacks** mit Large Titles und transluzentem Header je Tab.
3. **Liquid Glass sparsam**: Tab-Bar (nativ) und das Workout-Dock. Karten, Zahlen, Diagramme liegen auf opaken Flächen für Kontrast.
4. **Workout-Screen (Fokus-Ansicht):** Vollbild-Modal, Screen bleibt wach. Eine Übung und ein Satz im Fokus: Der Satz-Editor zeigt den aktuellen Satz mit großen Steppern, darunter die Satzliste dieser Übung. Einziger Abhaken-Ort ist der große Button im Glass-Dock unten (Daumenbereich); er hakt genau den Satz im Editor mit den angezeigten Werten ab, startet den Pausentimer im Dock und rückt weiter (nach der letzten Serie automatisch zur nächsten Übung). Andere Übungen über ‹ › oder die Übersicht (Form-Sheet). Rückgängig als Toast im Dock, RIR-Abfrage als kompakte Zeile während der Pause, erledigte Sätze werden gepuffert bearbeitet und in einem Schritt gesichert. Ab großer Schrift bzw. kleinen Displays Kompaktmodus.
5. **Dark Mode** vollständig über Tokens; Hero-Karten („strong“) invertieren bewusst.
6. **Zustände überall:** Jeder datengetriebene Screen hat Laden (Skeleton/Spinner), Fehler mit Retry, Leerzustand mit Aktion.
7. **Haptik:** selection für Chips/Stepper, light für Buttons, success beim Satzabschluss und Timer-Ende, medium für Workout-Start/-Ende.
8. **Barrierefreiheit:** Rollen/States auf allen interaktiven Elementen, 44-pt-Touch-Ziele, Dynamic Type bis 1,4×, Kontraste ≥ 4,5:1 für Text auf Surface (geprüft für Ember-Text auf hell: `#E3640A` statt `#FF7A1A`).

## Offen / noch nicht umgesetzt

- Reduce-Transparency-Prüfung (`AccessibilityInfo.isReduceTransparencyEnabled`) für `GlassSurface`.
- Eigene Icon-Variante für Android ist bewusst nicht vorgesehen (iOS-only).
