import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ExercisePreferencesDto, TrainingProfileDto, UpdateTrainingProfileBody, UserDto } from "@pondus/shared"
import { queryKeys } from "@/lib/query-client"
import { useApi, useSessionStore } from "@/services/session-store"

export function useProfile() {
  const api = useApi()
  return useQuery({ queryKey: queryKeys.profile, queryFn: () => api.get<TrainingProfileDto>("/api/v1/me/profile") })
}

export function useUpdateProfile() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateTrainingProfileBody) => api.put<TrainingProfileDto>("/api/v1/me/profile", body),
    onSuccess: data => {
      qc.setQueryData(queryKeys.profile, data)
      void qc.invalidateQueries({ queryKey: queryKeys.week() })
    },
  })
}

export function useExercisePreferences() {
  const api = useApi()
  return useQuery({ queryKey: queryKeys.preferences, queryFn: () => api.get<ExercisePreferencesDto>("/api/v1/me/exercise-preferences") })
}

export function useUpdateExercisePreferences() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ExercisePreferencesDto) => api.put<ExercisePreferencesDto>("/api/v1/me/exercise-preferences", body),
    onSuccess: data => qc.setQueryData(queryKeys.preferences, data),
  })
}

export function useUpdateUser() {
  const api = useApi()
  const setUser = useSessionStore(s => s.setUser)
  return useMutation({
    mutationFn: (body: { displayName?: string; weightUnit?: "kg" | "lb"; locale?: "de" | "en"; onboardingCompleted?: boolean }) => api.patch<UserDto>("/api/v1/me", body),
    onSuccess: user => setUser(user),
  })
}

export function useDeleteAccount() {
  const api = useApi()
  const signOut = useSessionStore(s => s.signOut)
  return useMutation({
    mutationFn: async () => {
      await api.delete("/api/v1/me")
      await signOut()
    },
  })
}

export function useExportData() {
  const api = useApi()
  return useMutation({ mutationFn: () => api.get<Record<string, unknown>>("/api/v1/me/export") })
}
