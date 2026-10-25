import type { ExerciseDto, SyncMutation } from "@pondus/shared"
import type { ApiClient } from "@/lib/api-client"

// In-memory stand-ins for SQLite (kv), the outbox owner (workout store) and the query cache.
jest.mock("@/storage/db", () => {
  const data = new Map<string, unknown>()
  return {
    kv: {
      get: (k: string) => (data.has(k) ? data.get(k) : null),
      set: (k: string, v: unknown) => void data.set(k, JSON.parse(JSON.stringify(v))),
      delete: (k: string) => void data.delete(k),
    },
    __data: data,
  }
})
jest.mock("@/lib/query-client", () => {
  const { QueryClient } = jest.requireActual("@tanstack/react-query")
  return { queryClient: new QueryClient() }
})
jest.mock("@/features/workout/active-workout-store", () => {
  const { create } = jest.requireActual("zustand")
  const queue: SyncMutation[] = []
  const useActiveWorkoutStore = create()((set: (p: object) => void) => ({
    pending: 0,
    sync: "idle",
    queue,
    dispatch: (_api: unknown, m: SyncMutation) => {
      queue.push(m)
      set({ pending: queue.length })
    },
    queuedMutations: () => [...queue],
    /** Test helper: the server took the first n mutations. */
    drain: (n: number) => {
      set({ sync: "syncing" })
      queue.splice(0, n)
      set({ pending: queue.length, sync: "idle" })
    },
  }))
  return { useActiveWorkoutStore }
})

import { queryClient } from "@/lib/query-client"
import { kv } from "@/storage/db"
import { useActiveWorkoutStore } from "@/features/workout/active-workout-store"
import { useExerciseNotesStore } from "../note-store"

const api = {} as ApiClient
const workoutStore = useActiveWorkoutStore as unknown as { getState: () => { queue: SyncMutation[]; drain: (n: number) => void } }
const bench = { id: "bench", slug: "bench", nameDe: "Bankdrücken", note: "Sitz 3", noteUpdatedAt: "2026-10-01T10:00:00.000Z" } as ExerciseDto

beforeEach(() => {
  useExerciseNotesStore.getState().clear()
  workoutStore.getState().queue.length = 0
  queryClient.clear()
  queryClient.setQueryData(["exercises", "bench"], bench)
  queryClient.setQueryData(["exercises", { all: "true" }], [bench])
})
// Drops the cache's garbage-collection timers so Jest can exit.
afterAll(() => queryClient.clear())

describe("exercise note store", () => {
  it("shows the edit at once, persists it and queues a set_exercise_note mutation", () => {
    useExerciseNotesStore.getState().hydrate()
    useExerciseNotesStore.getState().save(api, "bench", "  Sitz 4, Griff eng  ")
    const pending = useExerciseNotesStore.getState().pending.bench
    expect(pending?.note).toBe("Sitz 4, Griff eng")
    expect(kv.get("exercise_notes_pending")).toEqual({ bench: pending })
    expect(workoutStore.getState().queue).toEqual([{ kind: "set_exercise_note", exerciseId: "bench", body: { note: "Sitz 4, Griff eng", updatedAt: pending!.updatedAt } }])
  })

  it("queues blank text as a delete", () => {
    useExerciseNotesStore.getState().save(api, "bench", "   ")
    expect(useExerciseNotesStore.getState().pending.bench?.note).toBeNull()
    expect(workoutStore.getState().queue[0]).toMatchObject({ kind: "set_exercise_note", body: { note: null } })
  })

  it("stays pending while offline and moves into the query cache once the outbox drained", () => {
    useExerciseNotesStore.getState().hydrate()
    useExerciseNotesStore.getState().save(api, "bench", "Sitz 4")
    // Still queued (offline): pending, cache untouched.
    useExerciseNotesStore.getState().settle()
    expect(useExerciseNotesStore.getState().pending.bench).toBeDefined()
    expect(queryClient.getQueryData<ExerciseDto>(["exercises", "bench"])?.note).toBe("Sitz 3")

    workoutStore.getState().drain(1)
    expect(useExerciseNotesStore.getState().pending).toEqual({})
    expect(kv.get("exercise_notes_pending")).toBeNull()
    expect(queryClient.getQueryData<ExerciseDto>(["exercises", "bench"])?.note).toBe("Sitz 4")
    expect(queryClient.getQueryData<ExerciseDto[]>(["exercises", { all: "true" }])?.[0]?.note).toBe("Sitz 4")
  })

  it("restores queued edits after an app restart", () => {
    useExerciseNotesStore.getState().save(api, "bench", "Sitz 5")
    useExerciseNotesStore.setState({ pending: {} })
    useExerciseNotesStore.getState().hydrate()
    expect(useExerciseNotesStore.getState().pending.bench?.note).toBe("Sitz 5")
  })
})
