# Pondus – Produktspezifikation (MVP)

## Vision

Pondus organisiert Krafttraining vollständig: Profil → individueller Plan → schnelles Protokollieren → sichtbarer Fortschritt → Plan, der sich dem Alltag anpasst. Zielgruppe: regelmäßig Trainierende im Fitnessstudio, Einsteiger bis Erfahrene.

**Produktphilosophie:** Die App passt sich dem Nutzer an. Pläne sind Vorlagen mit Versionen, keine Kalender. Wochen dürfen anders aussehen; Verschieben, Auslassen, Tauschen und Frequenzänderungen zerstören nie Historie.

## Kernflüsse

1. **Registrierung & Onboarding (8 Schritte):** Ziele (bis 3), Erfahrung, Häufigkeit (+ optionale Wochentage), Dauer, Umgebung/Equipment, Fokusmuskeln (Rangfolge, max. 4), Übungspräferenzen (bevorzugt/neutral/ausgeschlossen, nach Muskelgruppe), Zusammenfassung → Profil speichern → Plan generieren → Onboarding abgeschlossen.
2. **Plan:** Aktiver Plan mit Aufteilung, Wochenansicht (konkrete Daten, Overrides pro Woche), Planstruktur, Begründung („Warum so?“), Session-Editor (Tausch mit Alternativen, Sätze/Wdh./Pause/RIR/Aufwärmsätze, Reihenfolge, Duplizieren, Entfernen, Hinzufügen, Wochentag), Anpassung (Häufigkeit/Dauer/Split) mit Vorschau und Diff, Übernehmen/Verwerfen; archivierte Pläne reaktivieren; freies Training.
3. **Workout:** Start aus Plan-Session (mit letzten Leistungswerten vorbelegt), als Wiederholung eines alten Workouts oder leer. Sätze direkt editieren, Haken = fertig + Pausentimer, Satztyp wechseln (W/Arbeit/Drop/Failure), RIR per Long-Press, Satz hinzufügen/löschen, Übung heute tauschen/überspringen/Pause ändern, Workout pausieren/fortsetzen/abbrechen/beenden. Lokal-first mit Outbox; Zusammenfassung mit Dauer, Sätzen, Wiederholungen, bewegtem Gewicht, Rekorden und Vergleich.
4. **Übungen:** Bibliothek (≥150), Suche, Filter (Muskel, Equipment, Kategorie, Schwierigkeit, Ausführung), Favoriten, Zuletzt, Eigene; Detail mit Ausführungshinweisen, Fehlern, Historie, 12-Wochen-Trend, Empfehlung, Alternativen; eigene Übungen anlegen/löschen (soft delete).
5. **Fortschritt:** Zeiträume, Wochenvolumen/Sätze/Einheiten/Dauer (Balken), Muskelgruppenverteilung, Bestleistungen (5 Typen, Schätzungen markiert), Historie mit Detail und „als Vorlage“, Übungsentwicklung (Top-Satz, e1RM, Volumen) mit Progressionsempfehlung.
6. **Profil:** Alle Onboarding-Angaben editierbar ohne Historienverlust, Theme, Gewichtseinheit, Pausentimer-Einstellungen, Sync-Status, Datenexport (JSON), Datenschutzhinweis, Abmelden, Konto löschen.

## Trainingslogik (Zusammenfassung)

Deterministisch, ohne Zufall oder externe KI. Details in `packages/shared/src/domain/`:

- **Split-Vorschlag** nach Frequenz/Ziel/Erfahrung: 1–2 Ganzkörper, 3 Ganzkörper (PPL für erfahrene Hypertrophie), 4 Ober/Unter, 5 Hybrid, 6 PPL×2. Überschreibbar.
- **Wochensatz-Ziele** pro Muskel nach Erfahrung (Anfänger 8, Fortgeschritten 12, Erfahren 14; min/max-Klammern), Fokus-Multiplikatoren (1,5/1,35/1,2/1,1), Nicht-Fokus 0,85, kleine Muskeln reduziert, Nebenmuskeln zählen 0,5.
- **Übungsauswahl** über eine Bewertungsfunktion: Primär-/Sekundärmuskel, Grund-/Isolationsübung je Slot, Präferenz (+3), Kontinuität (+3), Vertrautheit (+1), Equipment (Pflicht), Schwierigkeit vs. Erfahrung, Redundanz (gleiches Bewegungsmuster −4), Variation über Einheiten, Ein-/Mehrgelenkigkeit.
- **Reihenfolge:** Grundübungen zuerst (Fokusmuskeln vorne), dann Isolation, Rumpf zuletzt; Aufwärmsätze auf den ersten beiden Grundübungen.
- **Zeitbudget:** Dauer-Modell (Satzdauer + Pausen + Aufwärmen + Wechsel + Overhead); Trimmen zuerst bei Nicht-Fokus-Isolation.
- **Regeneration:** Überlappungsmatrix zwischen Muskelgruppen; Einheiten mit hoher Überlappung werden nicht direkt hintereinander gelegt.
- **Anpassung:** `proposeAdjustedPlan` erzeugt mit Kontinuitätsbonus einen neuen Plan und einen Diff (Einheiten, Übungen, Wochensätze, Dauer).
- **Progression:** Double Progression – alle Top-Sätze am oberen Ende mit RIR ≥ Ziel → kleinste Steigerung; unter Minimum zweimal in Folge → Schritt zurück; sonst Gewicht halten, Wiederholungen aufbauen.
- **Rekorde:** Maximalgewicht, Wiederholungen bei Gewicht, Satzvolumen, Einheitsvolumen, geschätztes 1RM (Epley, ≤12 Wdh., als Schätzung markiert).

## Nicht im MVP

Android, Apple Watch, Social Features, Kalorien, Körpermaße, Coaching-Marktplatz, Push außer Pausentimer, Mehrsprachigkeit (UI ist Deutsch; Datenmodell führt EN-Namen).

## Abnahmetest (Abschnitt 21 der Anforderung)

Der Ablauf Registrierung → Onboarding (Muskelaufbau, 4×, Fokus Brust/Rücken, Präferenzen, Ausschlüsse) → Plan → Einheit verschieben → Übung tauschen → Sätze anpassen → Workout mit letzten Werten → Protokoll → Pausentimer → Offline-Speicherung → Abschluss → Zusammenfassung → Historie → Rekord → nächstes Training mit letzten Werten → Frequenz 4→3 mit Vorschau → Historie unverändert ist serverseitig durch Integrationstests abgedeckt (`apps/api/test/*.test.ts`) und clientseitig durch Reducer-/Outbox-Tests. Ein manueller Durchlauf im iOS-Simulator steht aus (siehe IMPLEMENTATION_PLAN.md).
