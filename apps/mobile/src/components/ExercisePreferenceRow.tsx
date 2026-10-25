import { Pressable, StyleSheet, View } from "react-native"
import { SymbolView } from "expo-symbols"
import type { ExerciseDto } from "@pondus/shared"
import { EQUIPMENT_LABELS } from "@pondus/shared"
import { Text, useTheme } from "@/design-system"
import { haptic } from "@/lib/haptics"

export type Preference = "preferred" | "neutral" | "excluded"

export function ExercisePreferenceRow({ exercise, value, onChange, last }: { exercise: ExerciseDto; value: Preference; onChange: (v: Preference) => void; last?: boolean }) {
  const { colors, space, radius } = useTheme()
  const set = (v: Preference) => {
    haptic("selection")
    onChange(value === v ? "neutral" : v)
  }
  return (
    <View style={[styles.row, { paddingHorizontal: space[4], paddingVertical: space[3], borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={1}>
          {exercise.nameDe}
        </Text>
        <Text variant="footnote" color="tertiary" numberOfLines={1}>
          {exercise.equipment.map(e => EQUIPMENT_LABELS[e].de).join(" · ")}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Ausschließen" accessibilityState={{ selected: value === "excluded" }} onPress={() => set("excluded")} hitSlop={8} style={[styles.btn, { borderRadius: radius.pill, backgroundColor: value === "excluded" ? colors.dangerSoft : colors.surfaceMuted }]}>
        <SymbolView name="hand.raised" size={16} tintColor={value === "excluded" ? colors.danger : colors.textTertiary} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Bevorzugen" accessibilityState={{ selected: value === "preferred" }} onPress={() => set("preferred")} hitSlop={8} style={[styles.btn, { borderRadius: radius.pill, backgroundColor: value === "preferred" ? colors.accentSoft : colors.surfaceMuted }]}>
        <SymbolView name={value === "preferred" ? "heart.fill" : "heart"} size={16} tintColor={value === "preferred" ? colors.accent : colors.textTertiary} />
      </Pressable>
    </View>
  )
}
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 10 }, btn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" } })
