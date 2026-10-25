import { useRef, type ReactNode } from "react"
import { ScrollView, View, type ScrollViewInstance } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { Card, Text, useTheme } from "@/design-system"

export type GuideSection = "logging" | "first-time" | "progression"

/**
 * Plain-language help for the active workout: what to enter where, how to find
 * a starting weight, and how Pondus derives the next targets. Opened from the
 * workout screen; `section` scrolls straight to the relevant part.
 */
export default function WorkoutGuideScreen() {
  const { colors, space } = useTheme()
  const { section } = useLocalSearchParams<{ section?: GuideSection }>()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const scrolled = useRef(false)

  const Section = ({ id, title, children }: { id: GuideSection; title: string; children: ReactNode }) => (
    <View
      style={{ gap: space[2] }}
      onLayout={e => {
        if (id !== section || scrolled.current) return
        scrolled.current = true
        scrollRef.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - space[2]), animated: false })
      }}
    >
      <Text variant="title3" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  )
  const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <View style={{ flexDirection: "row", gap: space[3] }}>
      <Text variant="calloutStrong" style={{ width: 28 }} align="center">
        {label}
      </Text>
      <Text variant="callout" color="secondary" style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  )
  const P = ({ children }: { children: ReactNode }) => (
    <Text variant="callout" color="secondary">
      {children}
    </Text>
  )

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: space[4], gap: space[6], paddingBottom: space[10] }}>
      <Section id="logging" title="Was trage ich ein?">
        <Card style={{ gap: space[3] }}>
          <Row label="W">
            <Text variant="calloutStrong">Aufwärmsatz.</Text> Leichte Sätze zum Einstimmen. Sie zählen nicht zum Trainingsvolumen und nicht für deine Steigerung. Der Vorschlag darunter (z. B. „≈40 × 8“) steigert sich in Stufen auf etwa 40, 60 und 80 % deines Arbeitsgewichts.
          </Row>
          <Row label="1">
            <Text variant="calloutStrong">Arbeitssatz.</Text> Die Sätze, die zählen. Daraus berechnet Pondus deine Ziele fürs nächste Mal.
          </Row>
          <Row label="D">
            <Text variant="calloutStrong">Dropsatz</Text> – direkt im Anschluss mit weniger Gewicht weiter.
          </Row>
          <Row label="F">
            <Text variant="calloutStrong">Satz bis zum Muskelversagen.</Text>
          </Row>
          <P>Tippe auf die Satznummer, um den Satztyp zu ändern. Gedrückt halten öffnet Optionen wie RIR oder Löschen.</P>
        </Card>
        <Card style={{ gap: space[2] }}>
          <Text variant="calloutStrong">Gewicht</Text>
          <P>Langhantel: Gesamtgewicht inklusive Stange. Kurzhanteln: Gewicht einer Hantel. Maschinen und Kabelzug: der eingestellte Wert. Körpergewichtsübungen: nur Zusatzgewicht, sonst leer lassen. Assistierte Übungen: die Unterstützung – weniger ist hier besser.</P>
          <Text variant="calloutStrong">Wiederholungen</Text>
          <P>Trag ein, was du wirklich sauber geschafft hast – nicht das Ziel. Nur so kann Pondus richtig steigern.</P>
          <Text variant="calloutStrong">RIR (Wiederholungen in Reserve)</Text>
          <P>Wie viele saubere Wiederholungen wären noch gegangen? 0 = nichts mehr drin, 2 = zwei hätten noch geklappt. Nach dem Abhaken kannst du den RIR direkt antippen. Optional – ohne RIR entscheidet Pondus nur anhand der Wiederholungen.</P>
          <Text variant="calloutStrong">Abhaken</Text>
          <P>Hak jeden Satz ab, sobald er fertig ist; dann startet die Pause. Ist ein Feld leer, übernimmt das Abhaken den Wert des vorherigen Satzes.</P>
        </Card>
      </Section>

      <Section id="first-time" title="Zum ersten Mal: Startgewicht finden">
        <Card style={{ gap: space[2] }}>
          <P>Für eine neue Übung hat Pondus noch keine Daten, also tastest du dich heran:</P>
          <Row label="1">Aufwärmen: mit leerer Stange oder sehr leicht 8–10 Wiederholungen, dann in 2–3 Sprüngen schwerer und dabei weniger Wiederholungen.</Row>
          <Row label="2">Erster Arbeitssatz: Wähle ein Gewicht, mit dem du die untere Grenze des Bereichs (z. B. 8 bei 8–12) sauber schaffst und noch etwa so viele Wiederholungen übrig hast, wie der RIR vorgibt.</Row>
          <Row label="3">Anpassen: Ging es deutlich leichter (über dem Bereich), nimm im nächsten Satz 5–10 % mehr. Hast du die untere Grenze nicht geschafft, 10 % weniger.</Row>
          <Row label="4">Eintragen, was du wirklich gemacht hast. Ab dem nächsten Mal schlägt Pondus Gewicht und Wiederholungen vor.</Row>
          <P>Lieber etwas zu leicht starten: Saubere Technik zuerst, die Steigerung kommt von allein.</P>
        </Card>
      </Section>

      <Section id="progression" title="Wie Pondus deine Ziele berechnet">
        <Card style={{ gap: space[3] }}>
          <P>Jede Übung hat einen Wiederholungsbereich, z. B. 3 × 8–12. Pondus steigert in zwei Schritten: erst die Wiederholungen, dann das Gewicht. Grundlage ist dein schwerster Arbeitssatz vom letzten Mal; Aufwärmsätze zählen nicht.</P>
          <Row label="↑">
            <Text variant="calloutStrong">Mehr Wiederholungen.</Text> Du warst im Bereich, aber noch nicht oben (z. B. 10/9/9): gleiches Gewicht, pro Satz eine Wiederholung mehr.
          </Row>
          <Row label="↑">
            <Text variant="calloutStrong">Mehr Gewicht.</Text> Alle Sätze am oberen Ende (z. B. 3 × 12) und nicht unter dem RIR-Ziel: kleinster Gewichtsschritt drauf (Langhantel/Maschine 2,5 kg, Kurzhantel 2 kg) und zurück an die untere Grenze.
          </Row>
          <Row label="=">
            <Text variant="calloutStrong">Halten.</Text> Unter dem Bereich geblieben oder zu nah am Limit: gleiches Gewicht, in den Bereich hineinarbeiten.
          </Row>
          <Row label="↓">
            <Text variant="calloutStrong">Deload.</Text> Zweimal hintereinander unter dem Bereich mit gleichem Gewicht: ein Schritt zurück, um wieder sauber zu arbeiten.
          </Row>
          <P>Die Ziele stehen direkt in den Sätzen. Was du letztes Mal gemacht hast, steht klein unter der Satznummer. Tippe auf das Abzeichen an der Übung, um die Begründung zu sehen. Übungen aus allen Trainingstagen zählen – machst du Bankdrücken zweimal pro Woche, baut das Ziel immer auf dem letzten Mal auf.</P>
          <P>Körpergewichtsübungen steigern nur über Wiederholungen; bei assistierten Übungen sinkt stattdessen die Unterstützung.</P>
        </Card>
      </Section>
    </ScrollView>
  )
}
