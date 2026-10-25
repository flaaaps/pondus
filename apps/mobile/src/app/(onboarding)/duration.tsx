import { View } from "react-native"
import { OnboardingShell } from "@/components/OnboardingShell"
import { useOnboardingDraft } from "@/features/onboarding/draft-store"
import { Chip, Text, useTheme } from "@/design-system"

export default function DurationScreen() {
  const { space } = useTheme()
  const d = useOnboardingDraft()
  return (
    <OnboardingShell step="duration" title="Wie lange darf eine Einheit dauern?" body="Inklusive Aufwärmsätzen und Pausen. Der Plan wird so gebaut, dass er in dieses Budget passt." nextHref="/(onboarding)/equipment">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {[30, 45, 60, 75, 90].map(m => (
          <Chip key={m} label={m === 90 ? "90+ min" : `${m} min`} selected={d.sessionDurationMinutes === m} onPress={() => d.update({ sessionDurationMinutes: m })} />
        ))}
      </View>
      <Text variant="callout" color="secondary">
        {d.sessionDurationMinutes <= 45 ? "Kurze Einheiten bedeuten weniger Übungen pro Tag. Dafür empfiehlt sich eine höhere Frequenz." : "Genug Zeit für Grundübungen plus gezielte Isolationsarbeit."}
      </Text>
    </OnboardingShell>
  )
}
