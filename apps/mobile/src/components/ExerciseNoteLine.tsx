import { useState } from "react"
import { Pressable, View } from "react-native"
import { SymbolView } from "expo-symbols"
import { Text, useTheme } from "@/design-system"

export interface ExerciseNoteLineProps {
  /** Short visible prefix, e.g. "Notiz" or "Nur heute". */
  prefix: string
  /** Full VoiceOver name, e.g. "Notiz zu dieser Übung". */
  a11yName: string
  note: string | null
  /** Shown (as an add link) when there is no note; omit to render nothing then. */
  emptyLabel?: string
  /** Show the whole note right away (detail screen) instead of one line with "mehr". */
  expanded?: boolean
  onEdit: () => void
}

/**
 * A note in one compact line: tap edits it, "mehr" unfolds long notes in place.
 * Whether the text is cut off is measured with an invisible full-length copy,
 * so it stays right with any Dynamic Type size.
 */
export function ExerciseNoteLine({ prefix, a11yName, note, emptyLabel, expanded: alwaysExpanded, onEdit }: ExerciseNoteLineProps) {
  const { colors, space } = useTheme()
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState(1)
  if (!note) {
    if (!emptyLabel) return null
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={emptyLabel} accessibilityHint={`${a11yName}, bleibt für die nächsten Trainings gespeichert`} onPress={onEdit} hitSlop={4} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 44, opacity: pressed ? 0.5 : 1 })}>
        <SymbolView name="square.and.pencil" size={16} tintColor={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
        <Text variant="footnote" color="accent">
          {emptyLabel}
        </Text>
      </Pressable>
    )
  }
  const expanded = alwaysExpanded || open
  const truncated = !alwaysExpanded && lines > 1
  const text = (
    <>
      <Text variant="calloutStrong">{prefix}: </Text>
      {note}
    </>
  )
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${a11yName}: ${note}`}
        accessibilityHint="Doppeltippen zum Bearbeiten"
        onPress={onEdit}
        style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: space[2], minHeight: 44, paddingVertical: space[2], opacity: pressed ? 0.5 : 1 })}
      >
        <SymbolView name="note.text" size={16} tintColor={colors.textSecondary} style={{ marginTop: 2 }} accessibilityElementsHidden importantForAccessibility="no" />
        <View style={{ flex: 1 }}>
          <Text variant="callout" numberOfLines={expanded ? undefined : 1}>
            {text}
          </Text>
          {/* Same text without a line limit, invisible, only to know whether "mehr" is needed. */}
          {alwaysExpanded ? null : (
            <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, opacity: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text variant="callout" onTextLayout={e => setLines(e.nativeEvent.lines.length)}>
                {text}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
      {truncated ? (
        <Pressable accessibilityRole="button" accessibilityLabel={open ? "Notiz einklappen" : "Ganze Notiz anzeigen"} accessibilityState={{ expanded: open }} onPress={() => setOpen(v => !v)} hitSlop={8} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", paddingHorizontal: space[1], opacity: pressed ? 0.5 : 1 })}>
          <Text variant="footnote" color="accent">
            {open ? "weniger" : "mehr"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
