import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AdjustmentPreviewDto, PlanDto, PlanEditOp, PlanSessionDto, PlanWeekDto } from "@pondus/shared"
import { queryKeys } from "@/lib/query-client"
import { useApi } from "@/services/session-store"

export function useActivePlan() {
  const api = useApi()
  return useQuery({ queryKey: queryKeys.activePlan, queryFn: () => api.get<PlanDto | null>("/api/v1/plans/active") })
}

export function usePlans() {
  const api = useApi()
  return useQuery({ queryKey: queryKeys.plans, queryFn: () => api.get<{ id: string; name: string; status: string; splitType: string; weeklyFrequency: number; versionNumber: number; updatedAt: string }[]>("/api/v1/plans") })
}

export function useWeek(date?: string) {
  const api = useApi()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return useQuery({
    queryKey: queryKeys.week(date),
    queryFn: () => api.get<PlanWeekDto>(`/api/v1/plans/week?timeZone=${encodeURIComponent(tz)}${date ? `&date=${date}` : ""}`),
    staleTime: 30_000,
  })
}

export function useSession(id: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: queryKeys.session(id ?? ""),
    queryFn: () => api.get<{ planId: string; planName: string; versionNumber: number; session: PlanSessionDto }>(`/api/v1/plans/sessions/${id}`),
    enabled: !!id,
  })
}

function invalidatePlans(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["plans"] })
}

export function useGeneratePlan() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; splitType?: string; activate?: boolean }) => api.post<PlanDto>("/api/v1/plans/generate", body),
    onSuccess: plan => {
      qc.setQueryData(queryKeys.activePlan, plan)
      invalidatePlans(qc)
    },
  })
}

export function useEditPlan(planId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ops: PlanEditOp[]) => api.post<PlanDto>(`/api/v1/plans/${planId}/edit`, { ops }),
    onSuccess: plan => {
      qc.setQueryData(queryKeys.activePlan, (prev: PlanDto | null | undefined) => (prev?.id === plan.id ? plan : prev))
      qc.setQueryData(queryKeys.plan(plan.id), plan)
      invalidatePlans(qc)
    },
  })
}

export function useActivatePlan() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({ mutationFn: (planId: string) => api.post<PlanDto>(`/api/v1/plans/${planId}/activate`), onSuccess: () => invalidatePlans(qc) })
}
export function useArchivePlan() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({ mutationFn: (planId: string) => api.post<PlanDto>(`/api/v1/plans/${planId}/archive`), onSuccess: () => invalidatePlans(qc) })
}

export function usePreviewAdjustment(planId: string | undefined) {
  const api = useApi()
  return useMutation({
    mutationFn: (body: { weeklyFrequency?: number; sessionDurationMinutes?: number; splitType?: string; weekdays?: number[] }) => api.post<AdjustmentPreviewDto>(`/api/v1/plans/${planId}/adjustments/preview`, body),
  })
}
export function useApplyAdjustment(planId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (previewId: string) => api.post<PlanDto>(`/api/v1/plans/${planId}/adjustments/apply`, { previewId }),
    onSuccess: () => {
      invalidatePlans(qc)
      void qc.invalidateQueries({ queryKey: queryKeys.profile })
    },
  })
}
export function useDiscardAdjustment(planId: string | undefined) {
  const api = useApi()
  return useMutation({ mutationFn: (previewId: string) => api.delete(`/api/v1/plans/${planId}/adjustments/${previewId}`) })
}

export function useOverrideSession() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, ...body }: { sessionId: string; weekStart: string; action: "move" | "skip" | "reset"; date?: string }) => api.post<PlanWeekDto>(`/api/v1/plans/sessions/${sessionId}/override`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["plans", "week"] }),
  })
}
