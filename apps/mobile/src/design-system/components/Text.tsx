import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native"
import { useTheme } from "../theme"
import type { TypographyKey } from "../tokens"

export interface TextProps extends RNTextProps {
  variant?: TypographyKey
  color?: "primary" | "secondary" | "tertiary" | "inverse" | "accent" | "danger" | "success" | "onAccent"
  align?: TextStyle["textAlign"]
}

export function Text({ variant = "body", color = "primary", align, style, ...rest }: TextProps) {
  const { colors, typography } = useTheme()
  const colorValue = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    inverse: colors.textInverse,
    accent: colors.accentText,
    danger: colors.danger,
    success: colors.success,
    onAccent: colors.textOnAccent,
  }[color]
  return <RNText allowFontScaling maxFontSizeMultiplier={1.4} {...rest} style={[typography[variant], { color: colorValue, textAlign: align }, style]} />
}
