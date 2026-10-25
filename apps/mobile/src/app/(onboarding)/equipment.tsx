import { View } from "react-native"
import { ENVIRONMENT_EQUIPMENT, EQUIPMENT, EQUIPMENT_LABELS, TRAINING_ENVIRONMENTS, type Equipment } from "@pondus/shared"
import { OnboardingShell, OptionCard } from "@/components/OnboardingShell"
import { useOnboardingDraft } from "@/features/onboarding/draft-store"
import { Chip, Text, useTheme } from "@/design-system"
import { ENVIRONMENT_LABELS } from "@/lib/format"

export default function EquipmentScreen() {
  const { space } = useTheme()
  const d = useOnboardingDraft()
  const toggle = (e: Equipment) => d.update({ environment: "custom", availableEquipment: d.availableEquipment.includes(e) ? d.availableEquipment.filter(x => x !== e) : [...d.availableEquipment, e] })
  return (
    <OnboardingShell step="equipment" title="Wo trainierst du?" body="Wir schlagen nur Übungen vor, die du mit deinem Equipment auch ausführen kannst." nextHref="/(onboarding)/focus" nextDisabled={!d.availableEquipment.length}>
      <View style={{ gap: space[3] }}>
        {TRAINING_ENVIRONMENTS.map(env => (
          <OptionCard key={env} title={ENVIRONMENT_LABELS[env]!} selected={d.environment === env} onPress={() => d.update({ environment: env, availableEquipment: env === "custom" ? d.availableEquipment : ENVIRONMENT_EQUIPMENT[env] })} />
        ))}
      </View>
      <View style={{ gap: space[2] }}>
        <Text variant="calloutStrong" color="secondary">
          VERFÜGBARES EQUIPMENT
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {EQUIPMENT.map(e => (
            <Chip key={e} label={EQUIPMENT_LABELS[e].de} size="sm" selected={d.availableEquipment.includes(e)} onPress={() => toggle(e)} />
          ))}
        </View>
      </View>
    </OnboardingShell>
  )
}
