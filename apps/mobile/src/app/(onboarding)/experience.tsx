import { View } from "react-native"
import { EXPERIENCE_LEVELS } from "@pondus/shared"
import { OnboardingShell, OptionCard } from "@/components/OnboardingShell"
import { useOnboardingDraft } from "@/features/onboarding/draft-store"
import { EXPERIENCE_LABELS } from "@/lib/format"
import { useTheme } from "@/design-system"

const BODY: Record<string, string> = {
  beginner: "Weniger als ein Jahr regelmäßiges Krafttraining. Wir halten den Plan einfach und steigern behutsam.",
  intermediate: "Ein bis drei Jahre Erfahrung. Du kennst die Grundübungen und kannst mehr Volumen vertragen.",
  advanced: "Mehrere Jahre strukturiertes Training. Du willst volle Kontrolle über Sätze, Wiederholungen und Struktur.",
}

export default function ExperienceScreen() {
  const { space } = useTheme()
  const level = useOnboardingDraft(s => s.experienceLevel)
  const update = useOnboardingDraft(s => s.update)
  return (
    <OnboardingShell step="experience" title="Wie viel Erfahrung hast du?" body="Eine grobe Einordnung reicht. Sie beeinflusst Volumen und Übungsauswahl." nextHref="/(onboarding)/frequency">
      <View style={{ gap: space[3] }}>
        {EXPERIENCE_LEVELS.map(l => (
          <OptionCard key={l} title={EXPERIENCE_LABELS[l]!} body={BODY[l]} selected={level === l} onPress={() => update({ experienceLevel: l })} />
        ))}
      </View>
    </OnboardingShell>
  )
}
