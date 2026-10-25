import { View } from "react-native"
import { useTheme } from "../theme"
import { Text } from "./Text"

/**
 * Label + big number. `inverse` is for dark "strong" cards: label, value and
 * unit switch to the inverse text color (accent/success values stay coloured).
 */
export function Stat({ label, value, unit, tone = "primary", size = "md", inverse }: { label: string; value: string; unit?: string; tone?: "primary" | "accent" | "success"; size?: "md" | "lg"; inverse?: boolean }) {
  const { space } = useTheme()
  const valueColor = inverse && tone === "primary" ? "inverse" : tone
  return (
    <View style={{ gap: 2, flex: 1 }} accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}>
      <Text variant="caption" color={inverse ? "inverse" : "tertiary"} style={inverse ? { opacity: 0.7 } : undefined} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[1] }}>
        <Text variant={size === "lg" ? "numeralLarge" : "numeral"} color={valueColor} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
        {unit ? (
          <Text variant="callout" color={inverse ? "inverse" : "secondary"} style={inverse ? { opacity: 0.7 } : undefined}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
