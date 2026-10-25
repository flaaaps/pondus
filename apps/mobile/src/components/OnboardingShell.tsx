import { View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button, ProgressBar, Screen, Text, useTheme } from "@/design-system"
import type { PropsWithChildren } from "react"

export const ONBOARDING_STEPS = ["goals", "experience", "frequency", "duration", "equipment", "focus", "exercises", "summary"] as const

export function OnboardingShell({ step, title, body, children, nextHref, nextDisabled, nextTitle = "Weiter", onNext, loading }: PropsWithChildren<{ step: (typeof ONBOARDING_STEPS)[number]; title: string; body?: string; nextHref?: string; nextDisabled?: boolean; nextTitle?: string; onNext?: () => void; loading?: boolean }>) {
  const { colors, space } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const index = ONBOARDING_STEPS.indexOf(step)
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + space[3], paddingHorizontal: space[4], gap: space[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {index > 0 ? <Button title="Zurück" variant="ghost" size="sm" onPress={() => router.back()} /> : <View />}
          <Text variant="caption" color="tertiary">
            SCHRITT {index + 1} VON {ONBOARDING_STEPS.length}
          </Text>
        </View>
        <ProgressBar value={index + 1} max={ONBOARDING_STEPS.length} />
      </View>
      <Screen title={title} subtitle={body} bottomInset={80}>
        {children}
      </Screen>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: space[4], paddingBottom: insets.bottom + space[3], backgroundColor: colors.background }}>
        <Button title={nextTitle} fullWidth disabled={nextDisabled} loading={loading} onPress={() => (onNext ? onNext() : nextHref ? router.push(nextHref as never) : undefined)} />
      </View>
    </View>
  )
}

export function OptionCard({ title, body, selected, onPress, trailing }: { title: string; body?: string; selected: boolean; onPress: () => void; trailing?: React.ReactNode }) {
  const { colors, radius, space } = useTheme()
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.surface }}>
      <Text onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={{ padding: space[4] }}>
        <Text variant="bodyStrong">{title}</Text>
        {body ? (
          <Text variant="callout" color="secondary">
            {"\n"}
            {body}
          </Text>
        ) : null}
      </Text>
      {trailing}
    </View>
  )
}
