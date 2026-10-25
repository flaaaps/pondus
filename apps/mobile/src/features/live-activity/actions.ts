/** Button targets of the Live Activity (see WorkoutActivity.tsx). */
export type ActivityTarget = "complete-set" | "rest-minus-15" | "rest-plus-15" | "rest-done" | "rir-0" | "rir-1" | "rir-2" | "rir-3" | "rir-4"

export interface ActivityTap {
  /** Id of the activity that was tapped. */
  source: string
  target: string
  timestamp: number
}

export interface ActivityActionDeps {
  /** Activity the app currently shows; taps on any other one are stale. */
  currentActivityId: () => string | null
  /** Set whose RIR question the activity shows right now (from the props last sent). */
  shownRirSetKey: () => string | null
  /** Set whose RIR question is open in the app. */
  pendingRirSetKey: () => string | null
  restRunning: () => boolean
  completeNextSet: () => void
  adjustRest: (deltaSeconds: number) => void
  stopRest: () => void
  setRir: (setKey: string, rir: number) => void
}

export type ActionResult = "done" | "stale" | "repeat" | "ignored"

/** Taps on these within this window count once, so a double tap never logs two sets. */
const REPEAT_WINDOW_MS = 1000

/**
 * Maps a button tap to a store action. The activity then updates through the normal store
 * subscriptions. "±15 s" is not debounced: tapping it quickly several times is intended.
 */
export function createActivityActionHandler(deps: ActivityActionDeps) {
  const lastTap = new Map<"complete" | "rir", number>()
  const isRepeat = (group: "complete" | "rir", at: number) => {
    const prev = lastTap.get(group)
    lastTap.set(group, at)
    return prev !== undefined && at - prev >= 0 && at - prev < REPEAT_WINDOW_MS
  }

  return (tap: ActivityTap): ActionResult => {
    if (tap.source !== deps.currentActivityId()) return "stale"
    const target = tap.target as ActivityTarget
    if (target === "complete-set") {
      if (isRepeat("complete", tap.timestamp)) return "repeat"
      deps.completeNextSet()
      return "done"
    }
    if (target === "rest-minus-15" || target === "rest-plus-15") {
      if (!deps.restRunning()) return "ignored"
      deps.adjustRest(target === "rest-plus-15" ? 15 : -15)
      return "done"
    }
    if (target === "rest-done") {
      if (!deps.restRunning()) return "ignored"
      deps.stopRest()
      return "done"
    }
    const rir = /^rir-([0-4])$/.exec(target)
    if (rir) {
      // The RIR row replaces "Satz ✓" in place: the second half of a double tap on it lands on "0".
      const sinceComplete = tap.timestamp - (lastTap.get("complete") ?? -Infinity)
      if (sinceComplete >= 0 && sinceComplete < REPEAT_WINDOW_MS) return "repeat"
      if (isRepeat("rir", tap.timestamp)) return "repeat"
      const pending = deps.pendingRirSetKey()
      // Only answer the question the lifter actually saw; a later set may have replaced it meanwhile.
      if (!pending || pending !== deps.shownRirSetKey()) return "stale"
      deps.setRir(pending, Number(rir[1]))
      return "done"
    }
    return "ignored"
  }
}
