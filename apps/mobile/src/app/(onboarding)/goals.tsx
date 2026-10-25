import { View } from "react-native"
import { GOALS } from "@pondus/shared"
import { OnboardingShell, OptionCard } from "@/components/OnboardingShell"
import { useOnboardingDraft } from "@/features/onboarding/draft-store"
import { GOAL_LABELS } from "@/lib/format"
import { useTheme } from "@/design-system"

const BODY: Record<string, string> = {
  hypertrophy: "Mehr Muskelmasse mit moderaten Wiederholungen und ausreichend Volumen.",
  strength: "Schwerer heben: niedrige Wiederholungen, längere Pausen, Grundübungen im Fokus.",
  general_fitness: "Ausgewogen trainieren, fit und beweglich bleiben.",
  return_to_training: "Nach einer Pause behutsam wieder einsteigen, mit mehr Reserve.",
  muscle_focus: "Bestimmte Muskelgruppen gezielt nach vorne bringen.",
}

export default function GoalsScreen() {
  const { space } = useTheme()
  const goals = useOnboardingDraft(s => s.goals)
  const toggle = useOnboardingDraft(s => s.toggleGoal)
  return (
    <OnboardingShell step="goals" title="Was ist dein Ziel?" body="Du kannst bis zu drei Ziele kombinieren. Das erste bestimmt die Wiederholungsbereiche." nextHref="/(onboarding)/experience" nextDisabled={!goals.length}>
      <View style={{ gap: space[3] }}>
        {GOALS.map(g => (
          <OptionCard key={g} title={`${goals.indexOf(g) === 0 ? "★ " : ""}${GOAL_LABELS[g]}`} body={BODY[g]} selected={goals.includes(g)} onPress={() => toggle(g)} />
        ))}
      </View>
    </OnboardingShell>
  )
}
