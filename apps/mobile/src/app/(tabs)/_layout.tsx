import { DynamicColorIOS } from "react-native"
import { NativeTabs } from "expo-router/native-tabs"
import { palette } from "@/design-system"

/**
 * Native UITabBarController: Liquid Glass on iOS 26, system material before.
 * Colours use DynamicColorIOS because the native bar does not re-render on
 * JS theme changes. The bar never minimizes: on short screens a small bounce
 * collapsed it and the next tap landed on the mini bar instead of content.
 */
export default function TabsLayout() {
  const tint = DynamicColorIOS({ light: palette.ink900, dark: palette.ink50 })
  return (
    <NativeTabs minimizeBehavior="never" tintColor={tint} labelStyle={{ color: tint }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>Heute</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} />
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="exercises">
        <NativeTabs.Trigger.Icon sf={{ default: "dumbbell", selected: "dumbbell.fill" }} />
        <NativeTabs.Trigger.Label>Übungen</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <NativeTabs.Trigger.Label>Fortschritt</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
