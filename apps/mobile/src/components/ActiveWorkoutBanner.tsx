import { Pressable, View } from "react-native"
import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { Text, useTheme } from "@/design-system"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useElapsed } from "@/features/workout/use-elapsed"
import { formatTimer } from "@/lib/format"

/** Shown on Home/Plan while a workout is running so the user can jump back in. */
export function ActiveWorkoutBanner() {
  const workout = useActiveWorkoutStore(s => s.workout)
  const { colors, radius, space } = useTheme()
  const router = useRouter()
  const elapsed = useElapsed(workout)
  if (!workout) return null
  const done = workout.exercises.filter(e => !e.skipped && e.sets.some(s => s.completed)).length
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${workout.status === "paused" ? "Workout pausiert" : "Workout läuft"}: ${workout.name}, ${formatTimer(elapsed)}. Zum Workout`} onPress={() => router.push(`/workout/${workout.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <View style={{ backgroundColor: colors.surfaceStrong, borderRadius: radius.lg, padding: space[4], flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" color="inverse">
            {workout.status === "paused" ? "Workout pausiert" : "Workout läuft"} · {workout.name}
          </Text>
          <Text variant="footnote" color="inverse" style={{ opacity: 0.7 }}>
            {formatTimer(elapsed)} · {done} von {workout.exercises.filter(e => !e.skipped).length} Übungen
          </Text>
        </View>
        <SymbolView name="chevron.right" size={14} weight="semibold" tintColor={colors.textInverse} accessibilityElementsHidden importantForAccessibility="no" />
      </View>
    </Pressable>
  )
}
