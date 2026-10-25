import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ExerciseDto } from "@pondus/shared"
import { queryKeys } from "@/lib/query-client"
import { useApi } from "@/services/session-store"

export interface ExerciseFilters {
  q?: string
  muscles?: string[]
  equipment?: string[]
  category?: string[]
  difficulty?: string[]
  unilateral?: "true" | "false"
  favorites?: boolean
  custom?: boolean
  recent?: boolean
  sort?: "name" | "recent"
}

function toParams(f: ExerciseFilters): Record<string, string | undefined> {
  return {
    q: f.q?.trim() || undefined,
    muscles: f.muscles?.length ? f.muscles.join(",") : undefined,
    equipment: f.equipment?.length ? f.equipment.join(",") : undefined,
    category: f.category?.length ? f.category.join(",") : undefined,
    difficulty: f.difficulty?.length ? f.difficulty.join(",") : undefined,
    unilateral: f.unilateral,
    favorites: f.favorites ? "true" : undefined,
    custom: f.custom ? "true" : undefined,
    recent: f.recent ? "true" : undefined,
    sort: f.sort,
  }
}

export interface ExercisePage {
  items: ExerciseDto[]
  nextCursor: string | null
  total: number
}

export function useExercises(filters: ExerciseFilters, limit = 40) {
  const api = useApi()
  const params = toParams(filters)
  return useInfiniteQuery({
    queryKey: queryKeys.exercises(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
      qs.set("limit", String(limit))
      if (pageParam) qs.set("cursor", pageParam)
      return api.get<ExercisePage>(`/api/v1/exercises?${qs.toString()}`)
    },
    getNextPageParam: last => last.nextCursor ?? undefined,
    staleTime: 5 * 60_000,
  })
}

/** The full library in one go (≈ 170 rows) for pickers and offline name lookups. */
export function useAllExercises() {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.exercises({ all: "true" }),
    queryFn: async () => {
      const items: ExerciseDto[] = []
      let cursor: string | undefined
      do {
        const page = await api.get<ExercisePage>(`/api/v1/exercises?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`)
        items.push(...page.items)
        cursor = page.nextCursor ?? undefined
      } while (cursor)
      return items
    },
    staleTime: 10 * 60_000,
  })
}

export function useExercise(id: string | undefined) {
  const api = useApi()
  return useQuery({ queryKey: queryKeys.exercise(id ?? ""), queryFn: () => api.get<ExerciseDto>(`/api/v1/exercises/${id}`), enabled: !!id })
}

export function useAlternatives(id: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.alternatives(id ?? ""),
    queryFn: () => api.get<{ exercise: ExerciseDto; score: number; reasons: string[] }[]>(`/api/v1/exercises/${id}/alternatives`),
    enabled: !!id,
  })
}

export interface ExerciseHistoryItem {
  workoutId: string
  workoutName: string
  completedAt: string
  sets: { setNumber: number; setType: string; weightGrams: number | null; reps: number | null; rir: number | null; rpe: number | null; completed: boolean }[]
}
export function useExerciseHistory(id: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.exerciseHistory(id ?? ""),
    queryFn: () => api.get<{ items: ExerciseHistoryItem[]; nextCursor: string | null }>(`/api/v1/exercises/${id}/history?limit=20`),
    enabled: !!id,
  })
}

export function useToggleFavorite() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) => (favorite ? api.put<ExerciseDto>(`/api/v1/exercises/${id}/favorite`) : api.delete<ExerciseDto>(`/api/v1/exercises/${id}/favorite`)),
    onSuccess: data => {
      qc.setQueryData(queryKeys.exercise(data.id), data)
      void qc.invalidateQueries({ queryKey: ["exercises"] })
    },
  })
}

export function useCreateExercise() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<ExerciseDto>("/api/v1/exercises", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["exercises"] }),
  })
}
export function useDeleteExercise() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/exercises/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["exercises"] }),
  })
}

export function useMuscleGroups() {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.muscleGroups,
    queryFn: () => api.get<{ id: string; slug: string; nameDe: string; nameEn: string; region: string; displayOrder: number }[]>("/api/v1/exercises/muscle-groups"),
    staleTime: Infinity,
  })
}
