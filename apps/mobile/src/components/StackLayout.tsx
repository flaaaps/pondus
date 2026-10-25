import { Stack } from "expo-router"
import { useTheme } from "@/design-system"

/** Native stack with large titles and themed chrome, shared by every tab. */
export function StackLayout({ title }: { title: string }) {
  const { colors } = useTheme()
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: "systemChromeMaterial",
        headerLargeTitleShadowVisible: false,
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
