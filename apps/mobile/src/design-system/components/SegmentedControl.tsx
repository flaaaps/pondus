import { LayoutAnimation, Pressable, StyleSheet, View } from "react-native"
import { useTheme } from "../theme"
import { Text } from "./Text"
import { haptic } from "@/lib/haptics"

export function SegmentedControl<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors, radius, space } = useTheme()
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 3 }]}>
      {options.map(o => {
        const selected = o.value === value
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return
              haptic("selection")
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
              onChange(o.value)
            }}
            style={[styles.item, { borderRadius: radius.sm, paddingVertical: space[2], backgroundColor: selected ? colors.surface : "transparent" }]}
          >
            <Text variant="calloutStrong" color={selected ? "primary" : "secondary"}>
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
const styles = StyleSheet.create({ wrap: { flexDirection: "row" }, item: { flex: 1, alignItems: "center" } })
