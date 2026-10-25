import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { SymbolView } from "expo-symbols"
import { useTheme } from "../theme"
import { Text } from "./Text"
import type { ReactNode } from "react"

export interface ListRowProps {
  title: string
  subtitle?: string | null
  leading?: ReactNode
  trailing?: ReactNode
  value?: string | null
  onPress?: () => void
  chevron?: boolean
  destructive?: boolean
  style?: StyleProp<ViewStyle>
  first?: boolean
  last?: boolean
}

/** iOS-style inset row. Group several in a Card with padding="none". */
export function ListRow({ title, subtitle, leading, trailing, value, onPress, chevron, destructive, style, last }: ListRowProps) {
  const { colors, space } = useTheme()
  const body = (
    <View style={[styles.row, { paddingHorizontal: space[4], paddingVertical: space[3], borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border }, style]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <Text variant="body" color={destructive ? "danger" : "primary"} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" color="secondary" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {chevron || (onPress && !trailing && chevron !== false) ? <SymbolView name="chevron.right" size={14} weight="semibold" tintColor={colors.textTertiary} /> : null}
    </View>
  )
  if (!onPress) return body
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceMuted : "transparent" })}>
      {body}
    </Pressable>
  )
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  leading: { minWidth: 28, alignItems: "center" },
  text: { flex: 1, gap: 2 },
})
