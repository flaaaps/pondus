import type { RestTimerSnapshot } from "@/services/rest-timer-snapshot"
import { kv } from "./db"

const KEY = "rest_timer"

export const restTimerStorage = {
  load: () => kv.get<RestTimerSnapshot>(KEY),
  save: (s: RestTimerSnapshot) => kv.set(KEY, s),
  clear: () => kv.delete(KEY),
}
