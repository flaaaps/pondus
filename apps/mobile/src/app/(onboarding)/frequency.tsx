import { View } from "react-native"
import { suggestSplit } from "@pondus/shared"
import { OnboardingShell } from "@/components/OnboardingShell"
import { useOnboardingDraft } from "@/features/onboarding/draft-store"
import { Card, Chip, Text, useTheme } from "@/design-system"
import { WEEKDAYS_SHORT, SPLIT_LABELS } from "@/lib/format"

export default function FrequencyScreen() {
  const { space } = useTheme()
  const d = useOnboardingDraft()
  const split = suggestSplit(d.weeklyFrequency, d.goals[0] ?? "hypertrophy", d.experienceLevel)
  const toggleDay = (day: number) => {
    const has = d.preferredWeekdays.includes(day)
    const next = has ? d.preferredWeekdays.filter(x => x !== day) : [...d.preferredWeekdays, day]
    d.update({ preferredWeekdays: next.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) })
  }
  return (
    <OnboardingShell step="frequency" title="Wie oft willst du trainieren?" body="Das ist keine starre Vorgabe – du kannst es jederzeit ändern, ohne den Plan neu zu bauen." nextHref="/(onboarding)/duration">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {[2, 3, 4, 5, 6].map(n => (
          <Chip key={n} label={`${n}× pro Woche`} selected={d.weeklyFrequency === n} onPress={() => d.update({ weeklyFrequency: n, preferredWeekdays: [] })} />
        ))}
      </View>
      <Card tone="muted">
        <Text variant="calloutStrong">Vorschlag: {SPLIT_LABELS[split.splitType]}</Text>
        <Text variant="callout" color="secondary" style={{ marginTop: space[1] }}>
          {split.explanation}
        </Text>
      </Card>
      <View style={{ gap: space[2] }}>
        <Text variant="calloutStrong" color="secondary">
          BEVORZUGTE TAGE (OPTIONAL)
        </Text>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {[1, 2, 3, 4, 5, 6, 0].map(day => (
            <Chip key={day} label={WEEKDAYS_SHORT[day]!} size="sm" selected={d.preferredWeekdays.includes(day)} onPress={() => toggleDay(day)} />
          ))}
        </View>
        <Text variant="footnote" color="tertiary">
          {d.preferredWeekdays.length && d.preferredWeekdays.length !== d.weeklyFrequency ? `Wähle genau ${d.weeklyFrequency} Tage oder lass die Auswahl leer – dann verteilen wir die Einheiten für dich.` : "Ohne Auswahl verteilen wir die Einheiten mit sinnvollen Pausen über die Woche."}
        </Text>
      </View>
    </OnboardingShell>
  )
}
