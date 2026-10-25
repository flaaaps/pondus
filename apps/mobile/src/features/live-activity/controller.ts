import type { WorkoutActivityProps } from "./props"
import { staleDateFor } from "./props"

/** The parts of `expo-widgets` the controller uses; injected so the logic runs in Jest. */
export interface ActivityHandle {
  getId(): string
  update(props: WorkoutActivityProps, staleDate?: Date): Promise<void>
  end(dismissalPolicy?: "default" | "immediate" | { after: Date }, props?: WorkoutActivityProps): Promise<void>
}
export interface ActivityFactory {
  start(props: WorkoutActivityProps, url?: string, staleDate?: Date): ActivityHandle
  getInstances(): ActivityHandle[]
}
/** Which activity belongs to which workout, so a restart adopts the right one. */
export interface ActivityLinkStorage {
  load(): { activityId: string; workoutKey: string } | null
  save(link: { activityId: string; workoutKey: string }): void
  clear(): void
}

export type DesiredActivity =
  /** No workout, or the feature is off: end whatever is shown. */
  | { kind: "none" }
  | { kind: "active"; props: WorkoutActivityProps }
  /** Workout completed: show the summary, then let iOS remove it. */
  | { kind: "finished"; props: WorkoutActivityProps }

export interface ActivityControllerDeps {
  factory: ActivityFactory
  links: ActivityLinkStorage
  now: () => number
  /** ActivityKit only starts activities while the app is in the foreground. */
  canStart: () => boolean
  /** Starting failed, typically because Live Activities are off for Pondus in iOS settings. */
  onStartFailed: (error: unknown) => void
  onStarted: () => void
}

export const FINISHED_VISIBLE_MS = 15 * 60 * 1000

/**
 * Keeps at most one Live Activity in line with the desired state. Calls are queued, a
 * missing or failing activity never throws, and unchanged props are not sent again.
 */
export function createActivityController(deps: ActivityControllerDeps) {
  let current: { handle: ActivityHandle; workoutKey: string } | null = null
  let lastSent: string | null = null
  let adopted = false
  /** Workout for which starting failed; retried after `retryStart()` (app back in the foreground). */
  let failedFor: string | null = null
  let queue: Promise<void> = Promise.resolve()

  const endQuietly = async (handle: ActivityHandle, policy: Parameters<ActivityHandle["end"]>[0], props?: WorkoutActivityProps) => {
    try {
      await handle.end(policy, props)
    } catch {
      /* already gone */
    }
  }
  const forget = () => {
    current = null
    lastSent = null
    deps.links.clear()
  }

  /** After a restart: keep the activity of the current workout, end any other. */
  async function adopt(desired: DesiredActivity) {
    adopted = true
    let instances: ActivityHandle[] = []
    try {
      instances = deps.factory.getInstances()
    } catch {
      return
    }
    const link = deps.links.load()
    const keep =
      desired.kind === "active" && link && link.workoutKey === desired.props.workoutKey ? instances.find(i => i.getId() === link.activityId) : undefined
    for (const i of instances) if (i !== keep) await endQuietly(i, "immediate")
    if (keep && link) current = { handle: keep, workoutKey: link.workoutKey }
    else deps.links.clear()
  }

  async function apply(desired: DesiredActivity) {
    if (!adopted) await adopt(desired)

    if (desired.kind === "none") {
      if (current) await endQuietly(current.handle, "immediate")
      if (current) forget()
      return
    }

    const { props } = desired
    if (desired.kind === "finished") {
      if (current?.workoutKey === props.workoutKey) await endQuietly(current.handle, { after: new Date(deps.now() + FINISHED_VISIBLE_MS) }, props)
      else if (current) await endQuietly(current.handle, "immediate")
      if (current) forget()
      return
    }

    if (current && current.workoutKey !== props.workoutKey) {
      await endQuietly(current.handle, "immediate")
      forget()
    }
    const json = JSON.stringify(props)
    if (!current) {
      if (!deps.canStart() || failedFor === props.workoutKey) return
      try {
        const handle = deps.factory.start(props, `pondus://workout/${encodeURIComponent(props.workoutKey)}`, staleDateFor(props))
        current = { handle, workoutKey: props.workoutKey }
        lastSent = json
        failedFor = null
        deps.links.save({ activityId: handle.getId(), workoutKey: props.workoutKey })
        deps.onStarted()
      } catch (e) {
        failedFor = props.workoutKey
        deps.onStartFailed(e)
      }
      return
    }
    if (json === lastSent) return
    try {
      await current.handle.update(props, staleDateFor(props))
      lastSent = json
    } catch {
      // Ended by iOS (8 hours) or by the user: start a fresh one next time the app is in front.
      forget()
    }
  }

  return {
    /** Brings the activity in line with `desired`; resolves once this and all earlier calls are done. */
    sync(desired: DesiredActivity): Promise<void> {
      queue = queue.then(() => apply(desired)).catch(() => undefined)
      return queue
    },
    /** Allows another start attempt after a failure, e.g. when the app returns to the foreground. */
    retryStart() {
      failedFor = null
    },
  }
}

export type ActivityController = ReturnType<typeof createActivityController>
