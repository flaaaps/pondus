import "react-native-gesture-handler"
import { useEffect } from "react"
import { Stack, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { ThemeProvider, useTheme } from "@/design-system"
import { queryClient, queryPersister } from "@/lib/query-client"
import { useSessionStore } from "@/services/session-store"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useOutboxSync } from "@/services/sync"
import { getDb } from "@/storage/db"

void SplashScreen.preventAutoHideAsync()
getDb()

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister, maxAge: 7 * 24 * 3600 * 1000 }}>
            <ThemeProvider>
              <Root />
            </ThemeProvider>
          </PersistQueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function Root() {
  const { colors, scheme } = useTheme()
  const status = useSessionStore(s => s.status)
  const user = useSessionStore(s => s.user)
  const restore = useSessionStore(s => s.restore)
  const hydrate = useActiveWorkoutStore(s => s.hydrate)
  const hydrated = useActiveWorkoutStore(s => s.hydrated)
  const router = useRouter()
  const segments = useSegments()
  useOutboxSync()

  useEffect(() => {
    hydrate()
    void restore()
  }, [hydrate, restore])

  useEffect(() => {
    if (status === "booting" || !hydrated) return
    void SplashScreen.hideAsync()
    const group = segments[0]
    if (status === "signed_out" && group !== "(auth)") router.replace("/(auth)/login")
    else if (status === "signed_in" && user && !user.onboardingCompletedAt && group !== "(onboarding)") router.replace("/(onboarding)/goals")
    else if (status === "signed_in" && user?.onboardingCompletedAt && (group === "(auth)" || group === "(onboarding)")) router.replace("/(tabs)")
  }, [status, user, hydrated, segments, router])

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="workout/[id]" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="workout/summary" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="workout/pick-exercise" options={{ presentation: "modal", headerShown: true, title: "Übung wählen", headerTintColor: colors.accent, headerTitleStyle: { color: colors.textPrimary }, headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }} />
        <Stack.Screen name="workout/overview" options={{ presentation: "formSheet", sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="workout/guide" options={{ presentation: "modal", headerShown: true, title: "So funktioniert’s", headerTintColor: colors.accent, headerTitleStyle: { color: colors.textPrimary }, headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }} />
      </Stack>
    </>
  )
}
