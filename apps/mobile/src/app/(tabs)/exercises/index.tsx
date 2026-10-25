import { View } from "react-native"
import { Stack, useRouter } from "expo-router"
import { Button, useTheme } from "@/design-system"
import { ExerciseList } from "@/components/ExerciseList"

export default function ExercisesScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerRight: () => <Button title="Neu" variant="ghost" size="sm" onPress={() => router.push("/(tabs)/exercises/new")} /> }} />
      <ExerciseList onPress={e => router.push(`/(tabs)/exercises/${e.id}`)} />
    </View>
  )
}
