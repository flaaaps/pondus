import { forwardRef, useState, type ComponentRef } from "react"
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native"
import { useTheme } from "../theme"
import { Text } from "./Text"

export interface InputProps extends TextInputProps {
  label?: string
  error?: string | null
  hint?: string
}

export const Input = forwardRef<ComponentRef<typeof TextInput>, InputProps>(function Input({ label, error, hint, style, onFocus, onBlur, ...rest }, ref) {
  const { colors, radius, sizes, space, typography } = useTheme()
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: space[2] }}>
      {label ? (
        <Text variant="calloutStrong" color="secondary" importantForAccessibility="no" accessibilityElementsHidden>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.accent}
        onFocus={e => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={e => {
          setFocused(false)
          onBlur?.(e)
        }}
        {...rest}
        style={[
          typography.body,
          {
            height: sizes.inputHeight,
            paddingHorizontal: space[4],
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            color: colors.textPrimary,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: error ? colors.danger : focused ? colors.accent : colors.border,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="footnote" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" color="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  )
})
