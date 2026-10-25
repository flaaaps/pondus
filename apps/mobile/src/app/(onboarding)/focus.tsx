import { View } from "react-native"
import { MUSCLE_GROUPS, type MuscleSlug } from "@pondus/shared"
import { OnboardingShell } from "@/components/OnboardingShell"
import { useOnboardingDraft } from "@/features/onboarding/draft-store"
import { Button, Card, Chip, Text, useTheme } from "@/design-system"

export default function FocusScreen() {
  const { space } = useTheme()
  const d = useOnboardingDraft()
  const label = (m: MuscleSlug) => MUSCLE_GROUPS.find(g => g.slug === m)!.nameDe
  return (
    <OnboardingShell step="focus" title="Wo willst du Schwerpunkte setzen?" body="Optional. Bis zu vier Muskelgruppen bekommen mehr Sätze und stehen vorne in der Einheit. Alles andere wird trotzdem sinnvoll trainiert." nextHref="/(onboarding)/exercises">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {MUSCLE_GROUPS.map(g => (
          <Chip key={g.slug} label={g.nameDe} selected={d.focusMuscles.includes(g.slug)} onPress={() => d.toggleFocus(g.slug)} />
        ))}
      </View>
      {d.focusMuscles.length ? (
        <Card padding="sm">
          <Text variant="calloutStrong" color="secondary" style={{ marginBottom: space[2] }}>
            REIHENFOLGE (1 = WICHTIGSTE)
          </Text>
          {d.focusMuscles.map((m, i) => (
            <View key={m} style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingVertical: space[1] }}>
              <Text variant="numeral" color="accent" style={{ width: 28 }}>
                {i + 1}
              </Text>
              <Text variant="body" style={{ flex: 1 }}>
                {label(m)}
              </Text>
              <Button title="↑" variant="secondary" size="sm" disabled={i === 0} onPress={() => d.moveFocus(m, -1)} hapticStyle="none" />
              <Button title="↓" variant="secondary" size="sm" disabled={i === d.focusMuscles.length - 1} onPress={() => d.moveFocus(m, 1)} hapticStyle="none" />
            </View>
          ))}
        </Card>
      ) : null}
    </OnboardingShell>
  )
}
