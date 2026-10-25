import * as Haptics from "expo-haptics"

export type HapticKind = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error"

/** Fire-and-forget haptics; never throws (e.g. on simulator). */
export function haptic(kind: HapticKind = "light") {
  const run = async () => {
    switch (kind) {
      case "light":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      case "medium":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      case "heavy":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      case "selection":
        return Haptics.selectionAsync()
      case "success":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      case "warning":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      case "error":
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }
  run().catch(() => {})
}
