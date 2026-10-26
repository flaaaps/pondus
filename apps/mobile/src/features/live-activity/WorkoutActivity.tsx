// The function with the 'widget' directive becomes a string at build time and runs in the
// extension's own JS engine. Inside it: no hooks, no module constants, no helpers from outside.
// The components and modifiers imported below exist there as globals, so keep their names.
// Layout and limits: docs/LIVE_ACTIVITIES.md, section 5 (banner max. about 160 pt).
import { Button, HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui"
import { accessibilityLabel, activityBackgroundTint, buttonStyle, controlSize, font, foregroundStyle, frame, labelsHidden, lineLimit, monospacedDigit, padding, tint } from "@expo/ui/swift-ui/modifiers"
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

  // Buttons (iOS 17+): their taps reach the app via addUserInteractionListener, see actions.ts.
  // "Satz ✓" is always there while a set is open, also during the rest: iOS re-renders the activity
  // at the stale date (rest end) late or not at all while the app sleeps, so the countdown may sit at
  // 0:00 with the "rest" look for minutes. The lifter must still be able to tick off the next set.
  const small = [buttonStyle("bordered"), controlSize("small")]
  const complete = <Button target="complete-set" label="Satz ✓" modifiers={[buttonStyle("borderedProminent"), controlSize("small"), tint(accent), accessibilityLabel("Satz abhaken")]} />
  // Compact variant next to the RIR row (an empty label with systemImage renders a Label with a blank title).
  const completeIcon = <Button target="complete-set" label="✓" modifiers={[buttonStyle("borderedProminent"), controlSize("small"), tint(accent), accessibilityLabel("Satz abhaken")]} />
  const buttonRow =
    props.status !== "running" && props.status !== "done" ? null : props.rirPrompt !== null && resting ? (
      <HStack spacing={6}>
        <Text modifiers={[font({ textStyle: "caption", weight: "medium" }), accessibilityLabel("Wiederholungen in Reserve")]}>RIR</Text>
        <Button target="rir-0" label="0" modifiers={[...small, accessibilityLabel("0, am Limit")]} />
        <Button target="rir-1" label="1" modifiers={[...small, accessibilityLabel("1 Wiederholung in Reserve")]} />
        <Button target="rir-2" label="2" modifiers={[...small, accessibilityLabel("2 Wiederholungen in Reserve")]} />
        <Button target="rir-3" label="3" modifiers={[...small, accessibilityLabel("3 Wiederholungen in Reserve")]} />
        <Button target="rir-4" label="4+" modifiers={[...small, accessibilityLabel("4 oder mehr Wiederholungen in Reserve")]} />
        <Spacer />
        {props.canComplete ? completeIcon : null}
      </HStack>
    ) : resting ? (
      <HStack spacing={8}>
        {props.canComplete ? complete : null}
        <Button target="rest-done" label="Pause überspringen" systemImage="forward.end.fill" modifiers={small} />
      </HStack>
    ) : props.canComplete ? (
      complete
    ) : null

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
        {buttonRow}
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
        {buttonRow}
      </VStack>
    ),
  }
}
