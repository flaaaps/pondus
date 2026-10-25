import { View } from "react-native"
import { useTheme } from "../theme"
import { Text } from "./Text"

export function Stat({ label, value, unit, tone = "primary", size = "md" }: { label: string; value: string; unit?: string; tone?: "primary" | "accent" | "success"; size?: "md" | "lg" }) {
  const { space } = useTheme()
  return (
    <View style={{ gap: 2, flex: 1 }}>
      <Text variant="caption" color="tertiary">
        {label.toUpperCase()}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[1] }}>
        <Text variant={size === "lg" ? "numeralLarge" : "numeral"} color={tone}>
          {value}
        </Text>
        {unit ? (
          <Text variant="callout" color="secondary">
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
