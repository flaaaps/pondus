import { View } from "react-native"
import { useRouter } from "expo-router"
import { Card, ListRow, Text, useTheme } from "@/design-system"
import { ExerciseList } from "@/components/ExerciseList"
import { useAlternatives } from "@/features/exercises/queries"
import { useExercisePicker } from "@/features/exercises/picker-store"

/** Shared picker modal: suggested alternatives first (when swapping), then the full searchable library. */
export default function PickExerciseScreen() {
  const { colors, space } = useTheme()
  const router = useRouter()
  const picker = useExercisePicker()
  const alternatives = useAlternatives(picker.alternativesFor ?? undefined)
  const choose = (e: Parameters<typeof picker.pick>[0]) => {
    picker.pick(e)
    router.back()
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ExerciseList
        onPress={choose}
        header={
          alternatives.data?.length ? (
            <View style={{ gap: space[2], paddingTop: space[2] }}>
              <Text variant="calloutStrong" color="secondary">
                PASSENDE ALTERNATIVEN
              </Text>
              <Card padding="none">
                {alternatives.data.slice(0, 5).map((a, i, arr) => (
                  <ListRow key={a.exercise.id} title={a.exercise.nameDe} subtitle={a.reasons.join(" · ")} onPress={() => choose(a.exercise)} last={i === arr.length - 1} />
                ))}
              </Card>
              <Text variant="calloutStrong" color="secondary" style={{ marginTop: space[2] }}>
                GESAMTE BIBLIOTHEK
              </Text>
            </View>
          ) : undefined
        }
      />
    </View>
  )
}
