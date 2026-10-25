import { generatePlan, type GeneratePlanOptions } from "./planner"
import { MUSCLE_SLUGS, muscleGroup, type MuscleSlug } from "./muscles"
import type { ExerciseRef, PlanDraft, PlanSessionDraft, TrainingProfile } from "./types"
import { estimateSessionMinutes } from "./duration"
import { weeklySetsByMuscle } from "./volume"

export interface PlanDiff {
  oldFrequency: number
  newFrequency: number
  oldSplit: string
  newSplit: string
  sessionsAdded: string[]
  sessionsRemoved: string[]
  exercisesAdded: { exerciseId: string; name: string; sessionName: string }[]
  exercisesRemoved: { exerciseId: string; name: string; sessionName: string }[]
  exercisesKept: number
  weeklySetsDelta: { muscle: MuscleSlug; label: string; before: number; after: number }[]
  oldWeeklySetsTotal: number
  newWeeklySetsTotal: number
  oldAvgDurationMinutes: number
  newAvgDurationMinutes: number
  summary: string[]
}

function avgDuration(p: PlanDraft) {
  return Math.round(p.sessions.reduce((a, s) => a + s.estimatedDurationMinutes, 0) / Math.max(1, p.sessions.length))
}

export function diffPlans(before: PlanDraft, after: PlanDraft, byId: Map<string, ExerciseRef>): PlanDiff {
  const name = (id: string) => byId.get(id)?.nameDe ?? id
  const oldIds = new Set(before.sessions.flatMap(s => s.exercises.map(e => e.exerciseId)))
  const newIds = new Set(after.sessions.flatMap(s => s.exercises.map(e => e.exerciseId)))
  const exercisesAdded = after.sessions.flatMap(s =>
    s.exercises.filter(e => !oldIds.has(e.exerciseId)).map(e => ({ exerciseId: e.exerciseId, name: name(e.exerciseId), sessionName: s.name })),
  )
  const exercisesRemoved = before.sessions.flatMap(s =>
    s.exercises.filter(e => !newIds.has(e.exerciseId)).map(e => ({ exerciseId: e.exerciseId, name: name(e.exerciseId), sessionName: s.name })),
  )
  const kept = [...oldIds].filter(id => newIds.has(id)).length
  const oldNames = before.sessions.map(s => s.name)
  const newNames = after.sessions.map(s => s.name)
  const weeklySetsDelta = MUSCLE_SLUGS.filter(m => before.weeklySets[m] !== after.weeklySets[m]).map(m => ({
    muscle: m,
    label: muscleGroup(m).nameDe,
    before: before.weeklySets[m],
    after: after.weeklySets[m],
  }))
  const sum = (r: Record<MuscleSlug, number>) => Math.round(MUSCLE_SLUGS.reduce((a, m) => a + r[m], 0))
  const summary: string[] = []
  if (before.weeklyFrequency !== after.weeklyFrequency)
    summary.push(`Trainingshäufigkeit: ${before.weeklyFrequency}× → ${after.weeklyFrequency}× pro Woche.`)
  if (before.splitType !== after.splitType) summary.push(`Aufteilung: ${before.splitType} → ${after.splitType}.`)
  summary.push(`${kept} Übungen bleiben erhalten, ${exercisesAdded.length} kommen hinzu, ${exercisesRemoved.length} fallen weg.`)
  summary.push(`Wöchentliche Arbeitssätze: ${sum(before.weeklySets)} → ${sum(after.weeklySets)}.`)
  summary.push(`Dauer pro Einheit: ca. ${avgDuration(before)} → ${avgDuration(after)} Minuten.`)
  return {
    oldFrequency: before.weeklyFrequency,
    newFrequency: after.weeklyFrequency,
    oldSplit: before.splitType,
    newSplit: after.splitType,
    sessionsAdded: newNames.filter(n => !oldNames.includes(n)),
    sessionsRemoved: oldNames.filter(n => !newNames.includes(n)),
    exercisesAdded,
    exercisesRemoved,
    exercisesKept: kept,
    weeklySetsDelta,
    oldWeeklySetsTotal: sum(before.weeklySets),
    newWeeklySetsTotal: sum(after.weeklySets),
    oldAvgDurationMinutes: avgDuration(before),
    newAvgDurationMinutes: avgDuration(after),
    summary,
  }
}

/**
 * Propose a plan for a changed profile (frequency, duration, focus…) while
 * keeping as many of the current exercises as possible. The caller shows the
 * diff and persists only when the user accepts.
 */
export function proposeAdjustedPlan(
  current: PlanDraft,
  profile: TrainingProfile,
  exercises: ExerciseRef[],
  opts: Omit<GeneratePlanOptions, "continuityIds"> = {},
): { proposal: PlanDraft; diff: PlanDiff } {
  const continuityIds = current.sessions.flatMap(s => s.exercises.map(e => e.exerciseId))
  const keepSplit = current.weeklyFrequency === profile.weeklyFrequency ? current.splitType : undefined
  const proposal = generatePlan(profile, exercises, {
    ...opts,
    continuityIds,
    splitType: opts.splitType ?? (keepSplit === "custom" ? undefined : keepSplit),
    weekdays:
      opts.weekdays ??
      (current.sessions.length === profile.weeklyFrequency
        ? current.sessions.map(s => s.weekday).filter((d): d is number => d !== null)
        : undefined),
    name: opts.name ?? current.name,
  })
  const byId = new Map(exercises.map(e => [e.id, e] as const))
  return { proposal, diff: diffPlans(current, proposal, byId) }
}

/** Recompute derived fields (duration, focus muscles, weekly sets) after manual edits. */
export function recomputePlan(plan: PlanDraft, exercises: ExerciseRef[]): PlanDraft {
  const byId = new Map(exercises.map(e => [e.id, e] as const))
  const lookup = (id: string) => byId.get(id)
  const sessions: PlanSessionDraft[] = plan.sessions.map((s, i) => ({
    ...s,
    sequence: i + 1,
    exercises: s.exercises.map((e, j) => ({ ...e, sequence: j + 1 })),
    focusMuscles: Array.from(new Set(s.exercises.flatMap(e => byId.get(e.exerciseId)?.primaryMuscles ?? []))),
    estimatedDurationMinutes: estimateSessionMinutes(s.exercises, lookup),
  }))
  return { ...plan, sessions, weeklySets: weeklySetsByMuscle({ sessions }, lookup) }
}
