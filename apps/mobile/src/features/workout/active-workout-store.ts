import { create } from "zustand"
import { normalizeExerciseNote, type PlanSessionDto, type SyncMutation, type WorkoutDto, type WorkoutExerciseDto, type WorkoutSetDto, type ExerciseDto } from "@pondus/shared"
import { ApiError, type ApiClient } from "@/lib/api-client"
import { queryClient } from "@/lib/query-client"
import { useRestTimerStore } from "@/services/rest-timer-store"
import { activeWorkoutStorage } from "@/storage/active-workout"
import { applyLocalMutation, mergeLocalDrafts } from "@/storage/local-reducer"
import { createOutbox, sqliteOutboxStorage, type Outbox } from "@/storage/outbox"
import { uuid } from "@/lib/uuid"
import { keyOf, planCompletion, upcomingSet, type LibraryLookup, type SetCompletion } from "./selectors"

export type SyncStatus = "idle" | "syncing" | "offline" | "error"

interface ActiveWorkoutState {
  workout: WorkoutDto | null
  /** Server id once known (differs from workout.id for offline-started workouts until first sync). */
  serverId: string | null
  pending: number
  sync: SyncStatus
  lastSyncError: string | null
  rejected: string[]
  /** Exercise in focus (`clientId ?? id`), persisted with the workout. Null = first exercise with open sets. */
  focusedExerciseKey: string | null
  /** Completed working set waiting for its RIR answer, persisted with the workout. */
  rirPendingSetKey: string | null
  hydrated: boolean
  hydrate: () => void
  /** Start online from a plan session (rich prefill) with offline fallback. */
  startFromSession: (api: ApiClient, session: PlanSessionDto, exerciseNames: Record<string, string>) => Promise<WorkoutDto>
  startEmpty: (api: ApiClient, name?: string) => Promise<WorkoutDto>
  repeatWorkout: (api: ApiClient, source: WorkoutDto) => Promise<WorkoutDto>
  dispatch: (api: ApiClient, m: SyncMutation, extra?: { exerciseName?: string }) => void
  flush: (api: ApiClient) => Promise<void>
  /** Mutations still waiting in the outbox, oldest first. */
  queuedMutations: () => SyncMutation[]
  /** Returns the new workout exercise's clientId (null without an active workout). */
  addExercise: (api: ApiClient, exercise: ExerciseDto, opts?: { replaces?: WorkoutExerciseDto; targetSets?: number; restSeconds?: number }) => string | null
  setRestSeconds: (api: ApiClient, exercise: WorkoutExerciseDto, seconds: number) => void
  /** Removes the warm-up sets not done yet ("skip warm-up"). */
  skipOpenWarmups: (api: ApiClient, exercise: WorkoutExerciseDto) => void
  upsertSet: (api: ApiClient, exercise: WorkoutExerciseDto, set: Partial<WorkoutSetDto> & { clientId: string; setNumber: number }) => void
  /** Edit a not-yet-completed set locally (persisted, not queued); it syncs when completed. */
  updateLocalSet: (exerciseId: string, setId: string, patch: Partial<WorkoutSetDto>) => void
  addSet: (api: ApiClient, exercise: WorkoutExerciseDto) => void
  deleteSet: (api: ApiClient, set: WorkoutSetDto) => void
  skipExercise: (api: ApiClient, exercise: WorkoutExerciseDto, skipped: boolean) => void
  /** Note for this exercise in this workout only (`workout_exercises.notes`); null/blank clears it. */
  setWorkoutExerciseNote: (api: ApiClient, exercise: WorkoutExerciseDto, note: string | null) => void
  focusExercise: (key: string | null) => void
  setRirPending: (setKey: string | null) => void
  /** Ticks a set off with its effective values, starts the rest and asks for RIR. `advanceFocus` moves on to the next exercise right away. */
  completeSet: (api: ApiClient, target: { exerciseKey: string; setKey: string }, opts: CompleteOptions) => SetCompletion | null
  /** Ticks off the upcoming set (see `upcomingSet`), the one the Live Activity shows. */
  completeNextSet: (api: ApiClient, opts: CompleteOptions) => SetCompletion | null
  /** Saves the RIR of a completed set and closes the RIR question for it. */
  setRir: (api: ApiClient, setKey: string, rir: number) => void
  pause: (api: ApiClient) => void
  resume: (api: ApiClient) => void
  /**
   * Picks up the workout still open on the server when nothing is active locally (after a re-login,
   * on a new device). No-op offline or when a local workout exists. Returns the adopted workout.
   */
  resumeRemote: (api: ApiClient) => Promise<WorkoutDto | null>
  /** Continues a specific server workout (from the "already active" conflict) in place of the local state. */
  takeOverRemote: (api: ApiClient, workoutId: string) => Promise<WorkoutDto>
  /** Cancels a server workout that blocks starting a new one, without touching local state. */
  discardRemote: (api: ApiClient, workoutId: string) => Promise<void>
  complete: (api: ApiClient, notes?: string | null) => Promise<{ workout: WorkoutDto; serverId: string | null }>
  cancel: (api: ApiClient) => Promise<void>
  clearLocal: () => void
}

export interface CompleteOptions {
  lookup: LibraryLookup
  defaultRestSeconds: number
  advanceFocus?: boolean
}

let outbox: Outbox | null = null
const getOutbox = () => (outbox ??= createOutbox(sqliteOutboxStorage()))

function newSet(setNumber: number, prev?: WorkoutSetDto | null, targetReps?: number | null): WorkoutSetDto {
  return {
    id: uuid(),
    clientId: uuid(),
    setNumber,
    setType: "working",
    weightGrams: prev?.weightGrams ?? null,
    reps: prev?.reps ?? targetReps ?? null,
    rir: null,
    rpe: null,
    completed: false,
    completedAt: null,
    notes: null,
    targetWeightGrams: prev?.weightGrams ?? null,
    targetReps: prev?.reps ?? targetReps ?? null,
  }
}
/** Server views that change when a workout is completed or cancelled. */
function invalidateWorkoutViews() {
  void queryClient.invalidateQueries({ queryKey: ["workouts"] })
  void queryClient.invalidateQueries({ queryKey: ["progress"] })
  void queryClient.invalidateQueries({ queryKey: ["plans", "week"] })
  void queryClient.invalidateQueries({ queryKey: ["exercises"] })
}
const setToClientSet = (s: WorkoutSetDto) => {
  const id = s.clientId ?? s.id
  return { ...s, clientId: id, id: s.id }
}

function buildLocalFromSession(session: PlanSessionDto, exerciseNames: Record<string, string>): WorkoutDto {
  const now = new Date().toISOString()
  const id = uuid()
  return {
    id,
    clientId: id,
    status: "in_progress",
    name: session.name,
    trainingPlanId: null,
    trainingPlanVersionId: null,
    sourceSessionId: session.id,
    startedAt: now,
    completedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
    durationSeconds: null,
    notes: null,
    updatedAt: now,
    exercises: session.exercises.map((e, i) => {
      const cid = uuid()
      const sets: WorkoutSetDto[] = []
      for (let w = 0; w < e.warmupSets; w++) sets.push({ ...newSet(w + 1), setType: "warmup" })
      for (let s = 0; s < e.targetSets; s++) sets.push(newSet(e.warmupSets + s + 1, null, e.targetRepsMin))
      return {
        id: cid,
        clientId: cid,
        exerciseId: e.exerciseId,
        exerciseNameSnapshot: exerciseNames[e.exerciseId] ?? e.exerciseName,
        sequence: i + 1,
        targetSets: e.targetSets,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        restSeconds: e.restSeconds,
        targetRir: e.targetRir,
        skipped: false,
        notes: null,
        sets,
        previous: null,
      }
    }),
  }
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>()((set, get) => {
  const persist = (workout: WorkoutDto | null) => {
    // Another workout (or none) starts with a fresh focus.
    const prev = get().workout
    if (!workout || !prev || keyOf(prev) !== keyOf(workout)) set({ focusedExerciseKey: null, rirPendingSetKey: null })
    if (workout) activeWorkoutStorage.save(workout)
    else activeWorkoutStorage.clear()
    set({ workout, pending: getOutbox().size() })
  }
  const persistFocus = (patch: Partial<Pick<ActiveWorkoutState, "focusedExerciseKey" | "rirPendingSetKey">>) => {
    set(patch)
    const { workout, focusedExerciseKey, rirPendingSetKey } = get()
    if (workout) activeWorkoutStorage.saveFocus({ workoutKey: keyOf(workout), focusedExerciseKey, rirPendingSetKey })
  }
  const enqueue = (m: SyncMutation, extra?: { exerciseName?: string }) => {
    getOutbox().enqueue(extra?.exerciseName ? ({ ...m, exerciseName: extra.exerciseName } as unknown as SyncMutation) : m, uuid())
  }
  const workoutClientId = () => get().workout?.clientId ?? get().workout?.id ?? ""

  const adoptServer = (dto: WorkoutDto) => {
    persist(dto)
    set({ serverId: dto.id })
  }

  return {
    workout: null,
    serverId: null,
    pending: 0,
    sync: "idle",
    lastSyncError: null,
    rejected: [],
    focusedExerciseKey: null,
    rirPendingSetKey: null,
    hydrated: false,

    hydrate() {
      const w = activeWorkoutStorage.load()
      const focus = activeWorkoutStorage.loadFocus()
      const own = w && focus?.workoutKey === keyOf(w) ? focus : null
      set({
        workout: w,
        serverId: w && w.clientId !== w.id ? w.id : null,
        focusedExerciseKey: own?.focusedExerciseKey ?? null,
        rirPendingSetKey: own?.rirPendingSetKey ?? null,
        pending: getOutbox().size(),
        hydrated: true,
      })
    },

    async startFromSession(api, session, exerciseNames) {
      const clientId = uuid()
      try {
        const dto = await api.post<WorkoutDto>("/api/v1/workouts", { clientId, source: { type: "plan_session", planSessionId: session.id } })
        adoptServer(dto)
        return dto
      } catch (err) {
        if (!(err instanceof ApiError && err.isNetwork)) throw err
        // Offline: build locally and queue the structure.
        const local = buildLocalFromSession(session, exerciseNames)
        local.clientId = clientId
        local.id = clientId
        enqueue({ kind: "start_workout", body: { clientId, source: { type: "plan_session_client", planSessionId: session.id, name: session.name }, startedAt: local.startedAt } })
        for (const e of local.exercises) {
          enqueue(
            {
              kind: "add_exercise",
              workoutClientId: clientId,
              body: { clientId: e.clientId!, exerciseId: e.exerciseId!, targetSets: e.targetSets ?? 3, targetRepsMin: e.targetRepsMin ?? undefined, targetRepsMax: e.targetRepsMax ?? undefined, restSeconds: e.restSeconds ?? undefined, targetRir: e.targetRir, sequence: e.sequence },
            },
            { exerciseName: e.exerciseNameSnapshot },
          )
        }
        persist(local)
        set({ serverId: null, sync: "offline" })
        return local
      }
    },

    async startEmpty(api, name) {
      const clientId = uuid()
      const now = new Date().toISOString()
      try {
        const dto = await api.post<WorkoutDto>("/api/v1/workouts", { clientId, source: { type: "empty", name }, startedAt: now })
        adoptServer(dto)
        return dto
      } catch (err) {
        if (!(err instanceof ApiError && err.isNetwork)) throw err
        const local: WorkoutDto = { id: clientId, clientId, status: "in_progress", name: name ?? "Freies Training", trainingPlanId: null, trainingPlanVersionId: null, sourceSessionId: null, startedAt: now, completedAt: null, pausedAt: null, pausedSeconds: 0, durationSeconds: null, notes: null, exercises: [], updatedAt: now }
        enqueue({ kind: "start_workout", body: { clientId, source: { type: "empty", name }, startedAt: now } })
        persist(local)
        set({ serverId: null, sync: "offline" })
        return local
      }
    },

    async repeatWorkout(api, source) {
      const clientId = uuid()
      const dto = await api.post<WorkoutDto>("/api/v1/workouts", { clientId, source: { type: "repeat_workout", workoutId: source.id } })
      adoptServer(dto)
      return dto
    },

    dispatch(api, m, extra) {
      const next = applyLocalMutation(get().workout, m)
      enqueue(m, extra)
      persist(next)
      void get().flush(api)
    },

    async flush(api) {
      if (get().sync === "syncing") return
      const box = getOutbox()
      if (!box.size()) return set({ pending: 0, sync: "idle" })
      set({ sync: "syncing" })
      const hadActiveWorkout = !!get().workout
      const result = await box.flush(mutations => api.post("/api/v1/sync/workouts", { mutations }), { isNetworkError: err => err instanceof ApiError && err.isNetwork })
      if (result.offline) return set({ sync: "offline", pending: box.size() })
      if (result.rejected.length) set(s => ({ rejected: [...s.rejected, ...result.rejected.map(r => r.message)].slice(-5) }))
      // Once the queue is drained the server copy is authoritative; adopt it (ids, previous values).
      if (box.size() === 0 && get().workout) {
        try {
          const cid = workoutClientId()
          const serverId = get().serverId
          const dto = serverId ? await api.get<WorkoutDto>(`/api/v1/workouts/${serverId}`) : (await api.get<WorkoutDto | null>("/api/v1/workouts/active")) ?? null
          if (dto && (dto.clientId === cid || dto.id === serverId)) {
            if (dto.status === "completed" || dto.status === "cancelled") {
              // Completed offline → finished on the server now: keep the summary reference and clear the active slot.
              activeWorkoutStorage.saveLastCompleted(dto)
              persist(null)
              set({ serverId: dto.id })
              invalidateWorkoutViews()
            } else adoptServer(mergeLocalDrafts(dto, get().workout))
          }
        } catch {
          /* keep local copy */
        }
      }
      // A workout finished or discarded offline has no active slot any more; once its queue drains, refresh the server views.
      if (!hadActiveWorkout && result.sent > 0 && box.size() === 0) invalidateWorkoutViews()
      set({ sync: box.size() ? "error" : "idle", pending: box.size(), lastSyncError: result.rejected[0]?.message ?? null })
    },

    queuedMutations: () => getOutbox().peek().map(e => e.mutation),

    addExercise(api, exercise, opts) {
      const w = get().workout
      if (!w) return null
      const clientId = uuid()
      const targetSets = opts?.targetSets ?? opts?.replaces?.targetSets ?? 3
      get().dispatch(
        api,
        {
          kind: "add_exercise",
          workoutClientId: workoutClientId(),
          body: {
            clientId,
            exerciseId: exercise.id,
            targetSets,
            targetRepsMin: opts?.replaces?.targetRepsMin ?? undefined,
            targetRepsMax: opts?.replaces?.targetRepsMax ?? undefined,
            restSeconds: opts?.restSeconds ?? opts?.replaces?.restSeconds ?? undefined,
            targetRir: opts?.replaces?.targetRir ?? null,
            replacesWorkoutExerciseId: opts?.replaces ? (opts.replaces.clientId ?? opts.replaces.id) : undefined,
            sequence: opts?.replaces ? opts.replaces.sequence + 1 : undefined,
          },
        },
        { exerciseName: exercise.nameDe },
      )
      // Local placeholder sets so the user can log immediately (server creates its own placeholders; both are dropped if untouched).
      const current = get().workout
      if (!current) return clientId
      const ex = current.exercises.find(e => e.clientId === clientId)
      if (!ex) return clientId
      const sets = Array.from({ length: targetSets }, (_, i) => newSet(i + 1, null, ex.targetRepsMin))
      persist({ ...current, exercises: current.exercises.map(e => (e.clientId === clientId ? { ...e, sets } : e)) })
      return clientId
    },

    setRestSeconds(api, exercise, seconds) {
      get().dispatch(api, { kind: "update_exercise", workoutClientId: workoutClientId(), exerciseClientId: exercise.clientId ?? exercise.id, body: { restSeconds: seconds } })
    },

    skipOpenWarmups(api, exercise) {
      for (const s of exercise.sets.filter(x => x.setType === "warmup" && !x.completed)) get().deleteSet(api, s)
    },

    upsertSet(api, exercise, patch) {
      const w = get().workout
      if (!w) return
      const existing = exercise.sets.find(s => (s.clientId ?? s.id) === patch.clientId)
      const merged = { ...(existing ? setToClientSet(existing) : newSet(patch.setNumber)), ...patch }
      get().dispatch(api, {
        kind: "upsert_set",
        workoutClientId: workoutClientId(),
        exerciseClientId: exercise.clientId ?? exercise.id,
        body: {
          clientId: patch.clientId,
          setNumber: merged.setNumber,
          setType: merged.setType,
          weightGrams: merged.weightGrams,
          reps: merged.reps,
          rir: merged.rir,
          rpe: merged.rpe,
          completed: merged.completed,
          completedAt: merged.completed ? (merged.completedAt ?? new Date().toISOString()) : null,
          notes: merged.notes,
          updatedAt: new Date().toISOString(),
        },
      })
      // Preserve target hints locally (reducer cannot know them for new sets).
      const current = get().workout
      if (current && existing) {
        persist({
          ...current,
          exercises: current.exercises.map(e =>
            e.id !== exercise.id ? e : { ...e, sets: e.sets.map(s => ((s.clientId ?? s.id) === patch.clientId ? { ...s, targetWeightGrams: existing.targetWeightGrams, targetReps: existing.targetReps } : s)) },
          ),
        })
      }
    },

    addSet(api, exercise) {
      const w = get().workout
      if (!w) return
      const last = [...exercise.sets].reverse().find(s => s.setType === "working") ?? exercise.sets[exercise.sets.length - 1] ?? null
      const s = newSet(exercise.sets.length + 1, last, exercise.targetRepsMin)
      // Local only until the user completes/edits it; the server drops untouched placeholders anyway.
      persist({ ...w, exercises: w.exercises.map(e => (e.id === exercise.id ? { ...e, sets: [...e.sets, s] } : e)) })
    },

    updateLocalSet(exerciseId, setId, patch) {
      const w = get().workout
      if (!w) return
      persist({ ...w, exercises: w.exercises.map(e => (e.id !== exerciseId ? e : { ...e, sets: e.sets.map(s => (s.id === setId ? { ...s, ...patch } : s)) })) })
    },

    deleteSet(api, s) {
      const w = get().workout
      if (!w) return
      const id = s.clientId ?? s.id
      if (!s.completed && !w.exercises.some(e => e.sets.some(x => (x.clientId ?? x.id) === id && x.completed))) {
        // Pure local placeholder: no server round-trip needed.
        persist({ ...w, exercises: w.exercises.map(e => ({ ...e, sets: e.sets.filter(x => (x.clientId ?? x.id) !== id).map((x, i) => ({ ...x, setNumber: i + 1 })) })) })
        return
      }
      get().dispatch(api, { kind: "delete_set", workoutClientId: workoutClientId(), setClientId: id })
    },

    skipExercise(api, exercise, skipped) {
      get().dispatch(api, { kind: "update_exercise", workoutClientId: workoutClientId(), exerciseClientId: exercise.clientId ?? exercise.id, body: { skipped } })
    },

    setWorkoutExerciseNote(api, exercise, note) {
      get().dispatch(api, { kind: "update_exercise", workoutClientId: workoutClientId(), exerciseClientId: exercise.clientId ?? exercise.id, body: { notes: normalizeExerciseNote(note) } })
    },

    focusExercise(key) {
      persistFocus({ focusedExerciseKey: key })
    },
    setRirPending(setKey) {
      persistFocus({ rirPendingSetKey: setKey })
    },

    completeSet(api, target, opts) {
      const w = get().workout
      if (!w) return null
      const plan = planCompletion(w, target.exerciseKey, target.setKey, opts.lookup, opts.defaultRestSeconds)
      if (!plan) return null
      get().upsertSet(api, plan.exercise, { ...plan.patch, clientId: keyOf(plan.set), setNumber: plan.set.setNumber })
      if (plan.restSeconds !== null) useRestTimerStore.getState().start(plan.restSeconds, plan.next?.exerciseNameSnapshot ?? undefined)
      persistFocus({
        rirPendingSetKey: plan.asksRir ? keyOf(plan.set) : null,
        ...(opts.advanceFocus && plan.exerciseFinished && plan.next ? { focusedExerciseKey: keyOf(plan.next) } : {}),
      })
      return plan
    },

    completeNextSet(api, opts) {
      const w = get().workout
      const next = w ? upcomingSet(w, get().focusedExerciseKey) : null
      if (!next) return null
      // The focused exercise was done: the set belongs to the next one, so focus follows.
      if (next.upNext) get().focusExercise(keyOf(next.exercise))
      return get().completeSet(api, { exerciseKey: keyOf(next.exercise), setKey: keyOf(next.set) }, opts)
    },

    setRir(api, setKey, rir) {
      const w = get().workout
      const ex = w?.exercises.find(e => e.sets.some(s => keyOf(s) === setKey))
      const s = ex?.sets.find(x => keyOf(x) === setKey)
      if (ex && s) get().upsertSet(api, ex, { rir, clientId: setKey, setNumber: s.setNumber })
      if (get().rirPendingSetKey === setKey) persistFocus({ rirPendingSetKey: null })
    },

    pause(api) {
      get().dispatch(api, { kind: "pause", workoutClientId: workoutClientId(), body: { at: new Date().toISOString() } })
    },
    resume(api) {
      get().dispatch(api, { kind: "resume", workoutClientId: workoutClientId(), body: { at: new Date().toISOString() } })
    },

    async complete(api, notes) {
      const w = get().workout
      if (!w) throw new Error("no active workout")
      const m: SyncMutation = { kind: "complete", workoutClientId: workoutClientId(), body: { completedAt: new Date().toISOString(), notes: notes ?? undefined } }
      const local = applyLocalMutation(w, m)!
      enqueue(m)
      activeWorkoutStorage.saveLastCompleted(local)
      persist(null)
      await get().flush(api)
      const serverId = get().serverId
      invalidateWorkoutViews()
      return { workout: local, serverId: getOutbox().size() === 0 ? serverId : null }
    },

    async cancel(api) {
      const w = get().workout
      if (!w) return
      enqueue({ kind: "cancel", workoutClientId: workoutClientId() })
      persist(null)
      set({ serverId: null })
      await get().flush(api)
      void queryClient.invalidateQueries({ queryKey: ["plans", "week"] })
    },

    async resumeRemote(api) {
      if (get().workout) return null
      try {
        const dto = await api.get<WorkoutDto | null>("/api/v1/workouts/active")
        // The user may have started something locally while the request was out.
        if (!dto || get().workout) return null
        adoptServer(dto)
        return dto
      } catch {
        return null
      }
    },

    async takeOverRemote(api, workoutId) {
      const dto = await api.get<WorkoutDto>(`/api/v1/workouts/${workoutId}`)
      adoptServer(dto)
      return dto
    },

    async discardRemote(api, workoutId) {
      await api.post(`/api/v1/workouts/${workoutId}/cancel`)
      invalidateWorkoutViews()
    },

    clearLocal() {
      getOutbox().clear()
      persist(null)
      set({ serverId: null, sync: "idle", rejected: [] })
    },
  }
})
