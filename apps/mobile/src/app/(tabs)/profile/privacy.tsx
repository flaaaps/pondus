import { Stack } from "expo-router"
import { Card, Screen, Section, Text } from "@/design-system"

export default function PrivacyScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Datenschutz", headerLargeTitle: false }} />
      <Screen>
        <Section title="Was wir speichern">
          <Card>
            <Text variant="callout">E-Mail-Adresse und Anzeigename zur Anmeldung. Dein Trainingsprofil (Ziele, Erfahrung, Equipment, Präferenzen). Deine Trainingspläne inklusive aller Versionen. Deine Workouts mit Sätzen, Gewichten, Wiederholungen und Notizen. Daraus berechnete Bestleistungen.</Text>
          </Card>
        </Section>
        <Section title="Was wir nicht speichern">
          <Card>
            <Text variant="callout">Keine Standortdaten, keine Gesundheitsdaten außerhalb deiner Trainingseinträge, keine Werbe-IDs, kein Tracking durch Dritte.</Text>
          </Card>
        </Section>
        <Section title="Deine Rechte">
          <Card>
            <Text variant="callout">Du kannst jederzeit alle Daten als JSON exportieren und dein Konto samt aller Daten endgültig löschen (Profil → Konto & Daten). Passwörter werden ausschließlich als Argon2-Hash gespeichert; Zugangstoken liegen im iOS-Schlüsselbund.</Text>
          </Card>
        </Section>
        <Text variant="footnote" color="tertiary">
          Dieser Text beschreibt die technische Umsetzung dieser Version. Er ersetzt keine rechtlich geprüfte Datenschutzerklärung.
        </Text>
      </Screen>
    </>
  )
}
