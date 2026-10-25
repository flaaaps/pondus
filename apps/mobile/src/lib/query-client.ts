import AsyncStorage from "@react-native-async-storage/async-storage"
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import { QueryClient } from "@tanstack/react-query"
import { ApiError } from "./api-client"

/**
 * Server state cache. Persisted to AsyncStorage so plan, exercises and the
 * week view are available offline; mutations are not persisted here (the
 * workout outbox in SQLite owns offline writes).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 7 * 24 * 3600 * 1000,
      retry: (count, error) => !(error instanceof ApiError && error.status > 0 && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
})

export const queryPersister = createAsyncStoragePersister({ storage: AsyncStorage, key: "pondus-query-cache", throttleTime: 1000 })

export const queryKeys = {
  me: ["me"] as const,
  profile: ["me", "profile"] as const,
  preferences: ["me", "exercise-preferences"] as const,
  exercises: (params: Record<string, string | undefined>) => ["exercises", params] as const,
  exercise: (id: string) => ["exercises", id] as const,
  alternatives: (id: string) => ["exercises", id, "alternatives"] as const,
  exerciseHistory: (id: string) => ["exercises", id, "history"] as const,
  muscleGroups: ["muscle-groups"] as const,
  plans: ["plans"] as const,
  activePlan: ["plans", "active"] as const,
  plan: (id: string) => ["plans", id] as const,
  week: (date?: string) => ["plans", "week", date ?? "current"] as const,
  session: (id: string) => ["plans", "sessions", id] as const,
  workouts: (params: Record<string, string | undefined> = {}) => ["workouts", params] as const,
  workout: (id: string) => ["workouts", id] as const,
  summary: (id: string) => ["workouts", id, "summary"] as const,
  overview: (range: string) => ["progress", "overview", range] as const,
  exerciseProgress: (id: string, range: string) => ["progress", "exercise", id, range] as const,
  records: ["progress", "records"] as const,
}
