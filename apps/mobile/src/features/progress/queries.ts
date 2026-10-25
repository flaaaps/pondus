import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { ExerciseProgressDto, ProgressOverviewDto, WorkoutDto, WorkoutSummaryDto } from "@pondus/shared"
import { queryKeys } from "@/lib/query-client"
import { useApi } from "@/services/session-store"

export type Range = "4w" | "8w" | "12w" | "6m" | "1y" | "all"

export function useOverview(range: Range) {
  const api = useApi()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return useQuery({ queryKey: queryKeys.overview(range), queryFn: () => api.get<ProgressOverviewDto>(`/api/v1/progress/overview?range=${range}&timeZone=${encodeURIComponent(tz)}`) })
}

export function useExerciseProgress(id: string | undefined, range: Range) {
  const api = useApi()
  return useQuery({ queryKey: queryKeys.exerciseProgress(id ?? "", range), queryFn: () => api.get<ExerciseProgressDto>(`/api/v1/progress/exercises/${id}?range=${range}`), enabled: !!id })
}

export interface WorkoutHistoryItem {
  id: string
  name: string
  status: string
  startedAt: string
  completedAt: string | null
  durationSeconds: number | null
  workingSets: number
  tonnageGrams: number
  exerciseCount: number
  sourceSessionId: string | null
}
export function useWorkoutHistory(filters: { exerciseId?: string; from?: string; to?: string } = {}) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: queryKeys.workouts(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: "20", status: "completed" })
      if (filters.exerciseId) qs.set("exerciseId", filters.exerciseId)
      if (filters.from) qs.set("from", filters.from)
      if (filters.to) qs.set("to", filters.to)
      if (pageParam) qs.set("cursor", pageParam)
      return api.get<{ items: WorkoutHistoryItem[]; nextCursor: string | null }>(`/api/v1/workouts?${qs}`)
    },
    getNextPageParam: last => last.nextCursor ?? undefined,
  })
}

export function useWorkout(id: string | undefined) {
  const api = useApi()
  return useQuery({ queryKey: queryKeys.workout(id ?? ""), queryFn: () => api.get<WorkoutDto>(`/api/v1/workouts/${id}`), enabled: !!id })
}
export function useWorkoutSummary(id: string | undefined) {
  const api = useApi()
  return useQuery({ queryKey: queryKeys.summary(id ?? ""), queryFn: () => api.get<WorkoutSummaryDto>(`/api/v1/workouts/${id}/summary`), enabled: !!id, retry: 1 })
}

export function useRecords() {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.records,
    queryFn: () => api.get<{ items: { id: string; exerciseId: string | null; exerciseName: string; type: string; valueGrams: number | null; reps: number | null; weightGrams: number | null; achievedAt: string; workoutId: string | null; isEstimate: boolean }[] }>("/api/v1/progress/records?limit=50"),
  })
}
