// The function with the 'widget' directive becomes a string at build time and runs in the
// extension's own JS engine. Inside it: no hooks, no module constants, no helpers from outside.
// The components and modifiers imported below exist there as globals, so keep their names.
// Layout and limits: docs/LIVE_ACTIVITIES.md, section 5 (banner max. about 160 pt).
import { HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui"
import { activityBackgroundTint, font, foregroundStyle, frame, labelsHidden, lineLimit, monospacedDigit, padding, tint } from "@expo/ui/swift-ui/modifiers"
import type { LiveActivityComponent } from "expo-widgets"
import type { WorkoutActivityProps } from "./props"

export const workoutActivityLayout: LiveActivityComponent<WorkoutActivityProps> = (props, env) => {
  "widget"
  const accent = env.isLuminanceReduced ? "#C25A12" : "#FF7A1A"
  const secondary = foregroundStyle({ type: "hierarchical", style: "secondary" })
  const resting = props.rest !== null && !env.isStale
  const restRange = props.rest ? { lower: new Date(props.rest.startMs), upper: new Date(props.rest.endMs) } : null
  const durationRange = props.durationStartMs !== null ? { lower: new Date(props.durationStartMs), upper: new Date(props.durationStartMs + 12 * 3600 * 1000) } : null

  // Fixed widths instead of fixedSize(): timerInterval + fixedSize breaks the layout on iOS 27 (expo#51863).
  const restTimerBig =
    resting && restRange ? (
      <Text timerInterval={restRange} countsDown modifiers={[font({ size: 28, weight: "semibold" }), monospacedDigit(), foregroundStyle(accent), frame({ width: 64, alignment: "trailing" })]} />
    ) : props.rest !== null ? (
      <Text modifiers={[font({ textStyle: "subheadline", weight: "semibold" }), foregroundStyle(accent)]}>Pause vorbei</Text>
    ) : props.restPausedText !== null ? (
      <Text modifiers={[font({ size: 28, weight: "semibold" }), monospacedDigit(), secondary]}>{props.restPausedText}</Text>
    ) : props.status === "running" ? (
      <Text modifiers={[font({ textStyle: "subheadline", weight: "semibold" }), secondary]}>Bereit</Text>
    ) : null
  const restBar = resting && restRange ? <ProgressView timerInterval={restRange} countsDown modifiers={[tint(accent), labelsHidden()]} /> : null
  const duration = durationRange ? (
    <Text timerInterval={durationRange} countsDown={false} modifiers={[font({ textStyle: "caption" }), monospacedDigit(), secondary, frame({ width: 52, alignment: "leading" })]} />
  ) : (
    <Text modifiers={[font({ textStyle: "caption" }), monospacedDigit(), secondary]}>{props.durationText ?? ""}</Text>
  )
  const detail = props.target !== null || props.last !== null ? [props.target, props.last].filter(x => x !== null).join("  ·  ") : null
  const detailLine = detail !== null ? <Text modifiers={[font({ textStyle: "subheadline", weight: "semibold" }), monospacedDigit(), lineLimit(1)]}>{detail}</Text> : null
  const compactTimer =
    resting && restRange ? (
      <Text timerInterval={restRange} countsDown modifiers={[monospacedDigit(), foregroundStyle(accent), frame({ width: 44, alignment: "trailing" })]} />
    ) : durationRange ? (
      <Text timerInterval={durationRange} countsDown={false} modifiers={[monospacedDigit(), frame({ width: 52, alignment: "trailing" })]} />
    ) : (
      <Text modifiers={[monospacedDigit()]}>{props.durationText ?? ""}</Text>
    )

  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 }), activityBackgroundTint(null)]}>
        <HStack alignment="center">
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ textStyle: "headline" }), lineLimit(1)]}>{props.title}</Text>
            <HStack spacing={4}>
              <Text modifiers={[font({ textStyle: "caption" }), secondary, lineLimit(1)]}>{props.progress + " ·"}</Text>
              {duration}
            </HStack>
          </VStack>
          <Spacer />
          {restTimerBig}
        </HStack>
        {restBar}
        {detailLine}
      </VStack>
    ),
    bannerSmall: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ textStyle: "headline" }), lineLimit(1)]}>{props.setShort !== null ? props.title + " · " + props.setShort : props.title}</Text>
        {resting && restRange ? <Text timerInterval={restRange} countsDown modifiers={[monospacedDigit(), foregroundStyle(accent)]} /> : duration}
      </VStack>
    ),
    compactLeading: (
      <HStack spacing={4}>
        <Image systemName="dumbbell.fill" color={accent} />
        {props.setShort !== null ? <Text modifiers={[monospacedDigit()]}>{props.setShort}</Text> : null}
      </HStack>
    ),
    compactTrailing: compactTimer,
    minimal: resting && restRange ? <ProgressView timerInterval={restRange} countsDown modifiers={[tint(accent), labelsHidden()]} /> : <Image systemName="dumbbell.fill" color={accent} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ textStyle: "headline" }), lineLimit(1)]}>{props.title}</Text>
        <Text modifiers={[font({ textStyle: "caption" }), secondary, lineLimit(1)]}>{props.progressShort}</Text>
      </VStack>
    ),
    expandedTrailing: restTimerBig,
    expandedBottom: (
      <VStack alignment="leading" spacing={6}>
        {restBar}
        {detailLine}
      </VStack>
    ),
  }
}
