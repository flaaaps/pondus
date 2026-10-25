import { ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "../theme"
import { Text } from "./Text"
import type { PropsWithChildren, ReactNode } from "react"

export interface ScreenProps extends ScrollViewProps {
  title?: string
  subtitle?: string
  headerRight?: ReactNode
  /** Extra bottom padding for floating bars. */
  bottomInset?: number
  scroll?: boolean
  padded?: boolean
  contentStyle?: StyleProp<ViewStyle>
}

/** Standard scrolling screen with large title, safe areas and consistent gutters. */
export function Screen({ title, subtitle, headerRight, bottomInset = 0, scroll = true, padded = true, children, contentStyle, ...rest }: PropsWithChildren<ScreenProps>) {
  const { colors, space } = useTheme()
  const insets = useSafeAreaInsets()
  const header =
    title || headerRight ? (
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: space[4], gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          {title ? <Text variant="title1">{title}</Text> : null}
          {subtitle ? (
            <Text variant="callout" color="secondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {headerRight}
      </View>
    ) : null
  const content = [
    { paddingHorizontal: padded ? space[4] : 0, paddingTop: space[2], paddingBottom: insets.bottom + space[6] + bottomInset, gap: space[4] },
    contentStyle,
  ]
  if (!scroll)
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background }, ...content]}>
        {header}
        {children}
      </View>
    )
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...rest}
    >
      {header}
      {children}
    </ScrollView>
  )
}

export function Section({ title, action, children }: PropsWithChildren<{ title?: string; action?: ReactNode }>) {
  const { space } = useTheme()
  return (
    <View style={{ gap: space[2] }}>
      {title || action ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[1] }}>
          {title ? (
            <Text variant="calloutStrong" color="secondary">
              {title.toUpperCase()}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  )
}
