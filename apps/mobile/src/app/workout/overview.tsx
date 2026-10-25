import { useMemo } from "react"
import { Pressable, ScrollView, View } from "react-native"
import { useRouter } from "expo-router"
import { SymbolView } from "expo-symbols"
import { tonnageGrams } from "@pondus/shared"
import { Button, Card, Text, useTheme } from "@/design-system"
import { ExerciseThumbnail } from "@/components/ExerciseMedia"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useWorkoutUiStore } from "@/features/workout/workout-ui-store"
import { focusedExercise, formatSet, isWarmup, keyOf, visibleExercises } from "@/features/workout/selectors"
import { useElapsed } from "@/features/workout/use-elapsed"
import { useExercisePicker } from "@/features/exercises/picker-store"
import { useAllExercises } from "@/features/exercises/queries"
import { useApi } from "@/services/session-store"
import { useSettingsStore } from "@/services/settings-store"
import { formatTimer, formatTonnage } from "@/lib/format"
import { haptic } from "@/lib/haptics"

/** Sheet with every exercise of the active workout: progress per exercise, jump to one, restore skipped ones, add more. */
export default function WorkoutOverviewSheet() {
  const { colors, space, radius } = useTheme()
  const router = useRouter()
  const api = useApi()
  const store = useActiveWorkoutStore()
  const ui = useWorkoutUiStore()
  const picker = useExercisePicker()
  const library = useAllExercises()
  const unit = useSettingsStore(s => s.weightUnit)
  const defaultRest = useSettingsStore(s => s.defaultRestSeconds)
  const workout = store.workout
  const elapsed = useElapsed(workout)
  const slugById = useMemo(() => new Map((library.data ?? []).map(e => [e.id, e.slug])), [library.data])
  if (!workout) return null

  const visible = visibleExercises(workout)
  const skipped = workout.exercises.filter(e => e.skipped)
  const focusedKey = keyOf(focusedExercise(workout, store.focusedExerciseKey) ?? workout)
  const all = visible.flatMap(e => e.sets)
  const working = all.filter(s => !isWarmup(s))
  const volume = tonnageGrams(all.map(s => ({ setType: s.setType, weightGrams: s.weightGrams, reps: s.reps, completed: s.completed })))
  const syncText = store.sync === "offline" ? `Offline – ${store.pending} Änderungen warten` : store.pending ? `${store.pending} Änderungen werden synchronisiert` : store.sync === "error" ? "Synchronisierung fehlgeschlagen" : "Alles synchronisiert"

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: space[4], paddingTop: space[6], gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <Text variant="title2" accessibilityRole="header">
          {workout.name}
        </Text>
        <Text variant="footnote" color="secondary">
          {formatTimer(elapsed)} · {working.filter(s => s.completed).length}/{working.length} Arbeitssätze · {formatTonnage(volume, unit)}
        </Text>
        <Text variant="footnote" color={store.sync === "offline" || store.sync === "error" ? "danger" : "tertiary"}>
          {syncText}
        </Text>
      </View>

      <Card padding="none">
        {visible.map((ex, i) => {
          const key = keyOf(ex)
          const workingSets = ex.sets.filter(s => !isWarmup(s))
          const done = workingSets.filter(s => s.completed).length
          const finished = ex.sets.length > 0 && ex.sets.every(s => s.completed)
          const focused = key === focusedKey
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}. ${ex.exerciseNameSnapshot}, ${done} von ${workingSets.length} Sätzen${focused ? ", aktuell" : ""}`}
              onPress={() => {
                haptic("selection")
                ui.focusExercise(key)
                router.back()
              }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 72, paddingHorizontal: space[3], paddingVertical: space[2], backgroundColor: focused ? colors.accentSoft : pressed ? colors.surfaceMuted : "transparent", borderTopWidth: i ? 0.5 : 0, borderColor: colors.border, borderTopLeftRadius: i === 0 ? radius.lg : 0, borderTopRightRadius: i === 0 ? radius.lg : 0 })}
            >
              <ExerciseThumbnail slug={ex.exerciseId ? slugById.get(ex.exerciseId) : undefined} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {ex.exerciseNameSnapshot}
                </Text>
                <Text variant="footnote" color="secondary" numberOfLines={1}>
                  {done}/{workingSets.length} Sätze{done ? ` · ${workingSets.filter(s => s.completed).map(s => formatSet(s, unit)).join(" · ")}` : ""}
                </Text>
              </View>
              {finished ? <SymbolView name="checkmark.circle.fill" size={22} tintColor={colors.success} accessibilityElementsHidden importantForAccessibility="no" /> : focused ? <Text variant="footnote" color="accent">jetzt</Text> : null}
            </Pressable>
          )
        })}
      </Card>

      {skipped.length ? (
        <View style={{ gap: space[2] }}>
          <Text variant="caption" color="secondary">
            ÜBERSPRUNGEN
          </Text>
          <Card padding="sm">
            {skipped.map(ex => (
              <View key={keyOf(ex)} style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                <Text variant="body" color="secondary" numberOfLines={2} style={{ flex: 1 }}>
                  {ex.exerciseNameSnapshot}
                </Text>
                <Button
                  title="Wiederherstellen"
                  variant="ghost"
                  size="sm"
                  accessibilityLabel={`${ex.exerciseNameSnapshot} wiederherstellen`}
                  onPress={() => {
                    store.skipExercise(api, ex, false)
                    haptic("selection")
                  }}
                  hapticStyle="none"
                />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <Button
        title="Übung hinzufügen"
        variant="secondary"
        fullWidth
        onPress={() => {
          picker.open({ title: "Übung hinzufügen", onPick: e => ui.focusExercise(store.addExercise(api, e, { restSeconds: defaultRest })) })
          router.replace("/workout/pick-exercise")
        }}
      />
    </ScrollView>
  )
}
