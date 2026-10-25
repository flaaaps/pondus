import { useState } from "react"
import { Alert, View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { ENVIRONMENT_EQUIPMENT, EQUIPMENT, EQUIPMENT_LABELS, TRAINING_ENVIRONMENTS, type Equipment, type TrainingEnvironment } from "@pondus/shared"
import { Button, Chip, ErrorState, LoadingState, Screen, Section, Text, useTheme } from "@/design-system"
import { useProfile, useUpdateProfile } from "@/features/profile/queries"
import { ENVIRONMENT_LABELS } from "@/lib/format"

export default function EquipmentScreen() {
  const { space } = useTheme()
  const router = useRouter()
  const profile = useProfile()
  const update = useUpdateProfile()
  const [env, setEnv] = useState<TrainingEnvironment | null>(null)
  const [eq, setEq] = useState<Equipment[] | null>(null)
  if (profile.isLoading) return <LoadingState />
  if (!profile.data) return <ErrorState onRetry={() => void profile.refetch()} />
  const curEnv = env ?? profile.data.environment
  const curEq = eq ?? profile.data.availableEquipment
  return (
    <>
      <Stack.Screen options={{ title: "Equipment", headerLargeTitle: false }} />
      <Screen>
        <Section title="Trainingsumgebung">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {TRAINING_ENVIRONMENTS.map(e => (
              <Chip key={e} label={ENVIRONMENT_LABELS[e]!} selected={curEnv === e} onPress={() => { setEnv(e); if (e !== "custom") setEq(ENVIRONMENT_EQUIPMENT[e]) }} />
            ))}
          </View>
        </Section>
        <Section title="Verfügbar">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {EQUIPMENT.map(e => (
              <Chip key={e} label={EQUIPMENT_LABELS[e].de} size="sm" selected={curEq.includes(e)} onPress={() => { setEnv("custom"); setEq(curEq.includes(e) ? curEq.filter(x => x !== e) : [...curEq, e]) }} />
            ))}
          </View>
        </Section>
        <Text variant="footnote" color="tertiary">
          Übungen, die du mit deinem Equipment nicht ausführen kannst, werden bei der Planung und bei Alternativen ausgeblendet.
        </Text>
        <Button title="Speichern" fullWidth loading={update.isPending} disabled={!curEq.length} onPress={() => update.mutate({ environment: curEnv, availableEquipment: curEq }, { onSuccess: () => router.back(), onError: e => Alert.alert("Fehler", e instanceof Error ? e.message : "") })} />
      </Screen>
    </>
  )
}
