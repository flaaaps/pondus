import { Stack } from "expo-router"
import { useTheme } from "@/design-system"

/**
 * Native stack with large titles and themed chrome, shared by every tab.
 * The header is opaque in the theme background: a transparent header with a
 * fixed blur material rendered a light bar in dark mode and, on iOS 26, hid
 * the large title under the scroll edge effect.
 */
export function StackLayout({ title }: { title: string }) {
  const { colors, scheme } = useTheme()
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: false,
        headerStyle: { backgroundColor: colors.background },
        headerLargeStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerUserInterfaceStyle: scheme,
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.textPrimary },
        headerLargeTitleStyle: { color: colors.textPrimary },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  )
}
