import { Pressable, View } from "react-native"
import { SymbolView } from "expo-symbols"
import type { WorkoutExerciseDto } from "@pondus/shared"
import { Text, useTheme } from "@/design-system"
import { haptic } from "@/lib/haptics"
import type { SyncStatus } from "@/features/workout/active-workout-store"

export interface WorkoutTopBarProps {
  elapsed: string
  doneSets: number
  totalSets: number
  sync: SyncStatus
  pending: number
  exercises: WorkoutExerciseDto[]
  focusedIndex: number
  compact: boolean
  onMenu: () => void
  onFinish: () => void
  onPrev: () => void
  onNext: () => void
  onOverview: () => void
}

/** Workout bar (menu · time and progress · finish) plus exercise navigation (‹ position and overview ›). */
export function WorkoutTopBar({ elapsed, doneSets, totalSets, sync, pending, exercises, focusedIndex, compact, onMenu, onFinish, onPrev, onNext, onOverview }: WorkoutTopBarProps) {
  const { colors, space } = useTheme()
  const syncIcon = sync === "offline" ? "icloud.slash" : pending > 0 || sync === "syncing" ? "arrow.triangle.2.circlepath" : sync === "error" ? "exclamationmark.icloud" : "checkmark.icloud"
  const syncText = sync === "offline" ? `offline, ${pending} Änderungen warten` : pending > 0 ? `${pending} Änderungen werden synchronisiert` : sync === "error" ? "Synchronisierung fehlgeschlagen" : "synchronisiert"
  const allDone = exercises.length > 0 && exercises.every(e => e.sets.length > 0 && e.sets.every(s => s.completed))
  const prev = exercises[focusedIndex - 1]
  const next = exercises[focusedIndex + 1]

  const Icon = ({ name, label, onPress, disabled }: { name: "ellipsis.circle" | "chevron.left" | "chevron.right"; label: string; onPress: () => void; disabled?: boolean }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { haptic("selection"); onPress() }} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : pressed ? 0.5 : 1 })}>
      <SymbolView name={name} size={name === "ellipsis.circle" ? 26 : 20} weight="semibold" tintColor={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
    </Pressable>
  )
  const status = (
    <View accessible accessibilityLabel={`Dauer ${elapsed}, ${doneSets} von ${totalSets} Sätzen, ${syncText}`} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] }}>
      <Text variant="calloutStrong" style={{ fontVariant: ["tabular-nums"] }} maxFontSizeMultiplier={1.2}>
        {elapsed}
      </Text>
      <Text variant="footnote" color="secondary" maxFontSizeMultiplier={1.2} numberOfLines={1}>
        {doneSets}/{totalSets} Sätze
      </Text>
      <SymbolView name={syncIcon} size={15} tintColor={sync === "offline" || sync === "error" ? colors.warning : colors.textTertiary} accessibilityElementsHidden importantForAccessibility="no" />
    </View>
  )
  const nav = (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Icon name="chevron.left" label={prev ? `Vorherige Übung: ${prev.exerciseNameSnapshot}` : "Keine vorherige Übung"} onPress={onPrev} disabled={!prev} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Übung ${focusedIndex + 1} von ${exercises.length}. Übersicht öffnen`} onPress={onOverview} style={({ pressed }) => ({ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 4, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text variant="footnote" maxFontSizeMultiplier={1.2} numberOfLines={1}>
            {allDone ? "Alle Übungen erledigt" : `Übung ${focusedIndex + 1} von ${exercises.length}`}
          </Text>
          <SymbolView name="chevron.down" size={10} weight="semibold" tintColor={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
        </View>
        {compact ? null : (
          <View style={{ flexDirection: "row", gap: 5 }}>
            {exercises.map((e, i) => {
              const done = e.sets.length > 0 && e.sets.every(s => s.completed)
              return <View key={e.clientId ?? e.id} style={{ width: i === focusedIndex ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === focusedIndex ? colors.accent : done ? colors.success : colors.borderStrong }} />
            })}
          </View>
        )}
      </Pressable>
      <Icon name="chevron.right" label={next ? `Nächste Übung: ${next.exerciseNameSnapshot}` : "Keine weitere Übung"} onPress={onNext} disabled={!next} />
    </View>
  )
  return (
    <View style={{ paddingHorizontal: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Icon name="ellipsis.circle" label="Trainingsoptionen" onPress={onMenu} />
        {status}
        <Pressable accessibilityRole="button" accessibilityLabel="Workout beenden" onPress={onFinish} style={({ pressed }) => ({ minWidth: 44, height: 44, paddingHorizontal: space[2], alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
          <Text variant="calloutStrong" color="accent">
            Beenden
          </Text>
        </Pressable>
      </View>
      {nav}
    </View>
  )
}
