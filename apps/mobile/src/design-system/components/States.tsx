import { ActivityIndicator, StyleSheet, View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated"
import { SymbolView, type SFSymbol } from "expo-symbols"
import { useEffect } from "react"
import { useTheme } from "../theme"
import { Button } from "./Button"
import { Text } from "./Text"

export function EmptyState({ icon = "tray", title, body, actionTitle, onAction }: { icon?: SFSymbol; title: string; body?: string; actionTitle?: string; onAction?: () => void }) {
  const { colors, space } = useTheme()
  return (
    <View style={[styles.center, { padding: space[7], gap: space[3] }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
        <SymbolView name={icon} size={28} tintColor={colors.textSecondary} />
      </View>
      <Text variant="title3" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="callout" color="secondary" align="center">
          {body}
        </Text>
      ) : null}
      {actionTitle && onAction ? <Button title={actionTitle} variant="secondary" onPress={onAction} style={{ marginTop: space[2] }} /> : null}
    </View>
  )
}

export function ErrorState({ title = "Da ist etwas schiefgelaufen", body, onRetry }: { title?: string; body?: string; onRetry?: () => void }) {
  const { colors, space } = useTheme()
  return (
    <View style={[styles.center, { padding: space[7], gap: space[3] }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
        <SymbolView name="exclamationmark.triangle" size={28} tintColor={colors.danger} />
      </View>
      <Text variant="title3" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="callout" color="secondary" align="center">
          {body}
        </Text>
      ) : null}
      {onRetry ? <Button title="Erneut versuchen" variant="secondary" onPress={onRetry} style={{ marginTop: space[2] }} /> : null}
    </View>
  )
}

export function LoadingState({ label }: { label?: string }) {
  const { colors, space } = useTheme()
  return (
    <View style={[styles.center, { padding: space[8], gap: space[3] }]}>
      <ActivityIndicator color={colors.accent} />
      {label ? (
        <Text variant="footnote" color="tertiary">
          {label}
        </Text>
      ) : null}
    </View>
  )
}

export function Skeleton({ height = 16, width = "100%", radius: r }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  const { colors, radius } = useTheme()
  const opacity = useSharedValue(0.5)
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true)
  }, [opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[{ height, width, borderRadius: r ?? radius.sm, backgroundColor: colors.surfaceMuted }, style]} />
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
})
