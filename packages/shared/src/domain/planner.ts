import { estimateSessionMinutes } from "./duration"
import { DEFAULT_HEURISTICS, prescriptionCategory, type PlanningHeuristics } from "./heuristics"
import { MUSCLE_SLUGS, muscleGroup, type MuscleSlug } from "./muscles"
import { assignWeekdays } from "./schedule"
import { rankExercises, type ScoringContext } from "./scoring"
import { splitTemplate, suggestSplit, type SplitTemplate } from "./splits"
import type {
  ExerciseRef,
  PlanDraft,
  PlanExerciseDraft,
  PlanRationaleItem,
  PlanSessionDraft,
  SplitType,
  TrainingProfile,
} from "./types"
import { emptyMuscleRecord, weeklySetsByMuscle } from "./volume"

export interface GeneratePlanOptions {
  splitType?: SplitType
  heuristics?: PlanningHeuristics
  /** Exercise ids from an existing plan; rewarded so changes stay minimal. */
  continuityIds?: string[]
  /** Favourites / recently used; small bonus. */
  familiarIds?: string[]
  /** Weekdays to assign (JS getDay numbering). Falls back to profile.preferredWeekdays. */
  weekdays?: number[]
  name?: string
}

const CORE_MUSCLES: MuscleSlug[] = ["abs", "lower_back"]

/** Weekly working-set targets per muscle, after applying focus priorities. */
export function weeklySetTargets(profile: TrainingProfile, h: PlanningHeuristics = DEFAULT_HEURISTICS): Record<MuscleSlug, number> {
  const base = h.weeklySetsPerMuscle[profile.experienceLevel]
  const out = emptyMuscleRecord()
  const hasFocus = profile.musclePriorities.length > 0
  const priorityOf = new Map(profile.musclePriorities.map(p => [p.muscle, p.priority] as const))
  const goalFactor = profile.primaryGoal === "return_to_training" ? 0.8 : profile.primaryGoal === "strength" ? 0.9 : 1
  for (const m of MUSCLE_SLUGS) {
    let target = base.target * goalFactor
    // Small muscles (forearms, lower back, calves) need less direct work.
    if (m === "forearms") target *= 0.35
    if (m === "lower_back") target *= 0.4
    if (m === "calves") target *= 0.6
    if (m === "abs") target *= 0.6
    const p = priorityOf.get(m)
    if (p !== undefined) target *= h.priorityMultipliers[p] ?? 1.1
    else if (hasFocus) target *= h.nonFocusMultiplier
    out[m] = Math.min(base.max, Math.max(m === "forearms" || m === "lower_back" ? 2 : base.min * 0.75, Math.round(target)))
  }
  return out
}

interface BuildSessionInput {
  template: SplitTemplate["sessions"][number]
  sessionIndex: number
  profile: TrainingProfile
  exercises: ExerciseRef[]
  byId: Map<string, ExerciseRef>
  setsPerSession: Record<MuscleSlug, number>
  planExerciseIds: Set<string>
  continuity: Set<string>
  familiar: Set<string>
  h: PlanningHeuristics
}

function orderMuscles(muscles: MuscleSlug[], profile: TrainingProfile, h: PlanningHeuristics): MuscleSlug[] {
  const priorityOf = new Map(profile.musclePriorities.map(p => [p.muscle, p.priority] as const))
  return [...muscles].sort((a, b) => {
    const pa = priorityOf.get(a) ?? 99
    const pb = priorityOf.get(b) ?? 99
    if (pa !== pb) return pa - pb
    const ca = CORE_MUSCLES.includes(a) ? 1 : 0
    const cb = CORE_MUSCLES.includes(b) ? 1 : 0
    if (ca !== cb) return ca - cb
    return (h.muscleWeight[b] ?? 0) - (h.muscleWeight[a] ?? 0) || muscles.indexOf(a) - muscles.indexOf(b)
  })
}

function prescriptionFor(ex: ExerciseRef, profile: TrainingProfile, h: PlanningHeuristics) {
  return h.prescriptions[profile.primaryGoal][prescriptionCategory(ex.category)]
}

function sortSessionExercises(
  list: PlanExerciseDraft[],
  byId: Map<string, ExerciseRef>,
  h: PlanningHeuristics,
  priorityOf: Map<MuscleSlug, number>,
): PlanExerciseDraft[] {
  // Compounds first (focus muscles before big muscles), then isolation, core last.
  const rank = (d: PlanExerciseDraft) => {
    const ref = byId.get(d.exerciseId)
    if (!ref) return 99
    const primary = ref.primaryMuscles[0]
    const isCore = ref.category === "core" || (primary !== undefined && CORE_MUSCLES.includes(primary))
    if (isCore) return 50
    const weight = primary ? (h.muscleWeight[primary] ?? 0) : 0
    const prio = primary ? (priorityOf.get(primary) ?? 9) : 9
    return (ref.category === "compound" ? 0 : 20) + prio + (1 - weight)
  }
  return [...list]
    .map((d, i) => ({ d, i, r: rank(d) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x, i) => ({ ...x.d, sequence: i + 1 }))
}

function buildSession(input: BuildSessionInput): PlanSessionDraft {
  const { template, profile, exercises, byId, setsPerSession, planExerciseIds, continuity, familiar, h } = input
  const available = new Set(profile.availableEquipment)
  const focus = new Set(profile.musclePriorities.map(p => p.muscle))
  const preferred = new Set(profile.preferredExerciseIds)
  const excluded = new Set(profile.excludedExerciseIds)
  const maxExercises = h.maxExercisesPerSession[profile.experienceLevel]

  const chosen: PlanExerciseDraft[] = []
  const sessionPatterns = new Set<ExerciseRef["movementPattern"]>()
  const sessionIds = new Set<string>()
  const credit = emptyMuscleRecord()

  const baseCtx = (muscle: MuscleSlug, wantCompound: boolean): ScoringContext => ({
    targetMuscle: muscle,
    focusMuscles: focus,
    preferred,
    excluded,
    continuity,
    familiar,
    availableEquipment: available,
    experience: profile.experienceLevel,
    sessionPatterns,
    sessionExerciseIds: sessionIds,
    planExerciseIds,
    wantCompound,
  })

  const add = (ex: ExerciseRef, sets: number) => {
    const p = prescriptionFor(ex, profile, h)
    chosen.push({
      exerciseId: ex.id,
      sequence: chosen.length + 1,
      targetSets: sets,
      targetRepsMin: p.repsMin,
      targetRepsMax: p.repsMax,
      restSeconds: p.restSeconds,
      targetRir: p.rir,
      warmupSets: 0,
      notes: null,
    })
    sessionIds.add(ex.id)
    sessionPatterns.add(ex.movementPattern)
    for (const m of ex.primaryMuscles) credit[m] += sets
    for (const m of ex.secondaryMuscles) credit[m] += sets * h.secondarySetCredit
  }

  const muscles = orderMuscles(template.muscles, profile, h)
  const need = (m: MuscleSlug) => setsPerSession[m] - credit[m]

  // Pass 1: one main exercise per muscle that still needs work.
  for (const muscle of muscles) {
    if (chosen.length >= maxExercises) break
    const remaining = need(muscle)
    if (remaining < 1) continue
    const wantCompound = !CORE_MUSCLES.includes(muscle) && muscle !== "biceps" && muscle !== "triceps" && muscle !== "calves" && muscle !== "forearms"
    const ranked = rankExercises(exercises, baseCtx(muscle, wantCompound))
    const pick = ranked[0]
    if (!pick) continue
    const sets = Math.max(h.setsPerExercise.min, Math.min(h.setsPerExercise.max, Math.round(remaining)))
    add(pick.exercise, sets)
  }

  // Pass 2: fill remaining deficits with a second (usually isolation) exercise, largest deficit first.
  const deficits = () =>
    muscles
      .map(m => ({ m, d: need(m) }))
      .filter(x => x.d >= 1.5)
      .sort((a, b) => b.d - a.d)
  for (const { m, d } of deficits()) {
    if (chosen.length >= maxExercises) break
    const ranked = rankExercises(exercises, baseCtx(m, false))
    const pick = ranked[0]
    if (!pick) continue
    add(pick.exercise, Math.max(h.setsPerExercise.min, Math.min(h.setsPerExercise.max, Math.round(d))))
  }

  // Warm-up sets on the first two compounds.
  let warmed = 0
  const priorityOf = new Map(profile.musclePriorities.map(p => [p.muscle, p.priority] as const))
  let ordered = sortSessionExercises(chosen, byId, h, priorityOf)
  ordered = ordered.map(d => {
    const ref = byId.get(d.exerciseId)
    if (ref?.category === "compound" && warmed < 2) {
      warmed += 1
      return { ...d, warmupSets: h.warmupSetsForFirstCompounds }
    }
    return d
  })

  // Fit the time budget: trim sets from the end (isolation first), then drop exercises.
  const lookup = (id: string) => byId.get(id)
  const budget = profile.sessionDurationMinutes
  let guard = 0
  // Trim order: lowest-priority muscle first, isolation before compound, later exercises first.
  const trimRank = (d: PlanExerciseDraft, index: number) => {
    const ref = byId.get(d.exerciseId)
    const primary = ref?.primaryMuscles[0]
    const prio = primary ? (priorityOf.get(primary) ?? 50) : 50
    return prio * 1000 - (ref?.category === "compound" ? 100 : 0) - index
  }
  while (estimateSessionMinutes(ordered, lookup, h) > budget && ordered.length > 1 && guard++ < 100) {
    const candidates = ordered
      .map((d, i) => ({ d, i, r: trimRank(d, i) }))
      .filter(x => x.d.targetSets > h.setsPerExercise.min)
      .sort((a, b) => b.r - a.r)
    const pick = candidates[0]
    if (pick) {
      ordered[pick.i] = { ...pick.d, targetSets: pick.d.targetSets - 1 }
    } else {
      const drop = ordered.map((d, i) => ({ i, r: trimRank(d, i) })).sort((a, b) => b.r - a.r)[0]!
      ordered = ordered.filter((_, i) => i !== drop.i).map((d, i) => ({ ...d, sequence: i + 1 }))
    }
  }

  const focusMuscles = Array.from(
    new Set(ordered.flatMap(d => byId.get(d.exerciseId)?.primaryMuscles ?? [])),
  )

  return {
    name: template.name,
    sequence: input.sessionIndex + 1,
    weekday: null,
    focusMuscles,
    estimatedDurationMinutes: estimateSessionMinutes(ordered, lookup, h),
    exercises: ordered,
  }
}

function buildRationale(
  profile: TrainingProfile,
  template: SplitTemplate,
  sessions: PlanSessionDraft[],
  weeklySets: Record<MuscleSlug, number>,
  targets: Record<MuscleSlug, number>,
  byId: Map<string, ExerciseRef>,
): PlanRationaleItem[] {
  const items: PlanRationaleItem[] = []
  items.push({ key: "split", title: "Trainingsaufteilung", body: template.explanation })

  if (profile.musclePriorities.length) {
    const names = [...profile.musclePriorities]
      .sort((a, b) => a.priority - b.priority)
      .map(p => muscleGroup(p.muscle).nameDe)
    items.push({
      key: "focus",
      title: "Deine Schwerpunkte",
      body: `${names.join(", ")} bekommen mehr Sätze pro Woche und stehen in den Einheiten weiter vorne, wenn du noch frisch bist. Die übrigen Muskelgruppen werden trotzdem mit einem Erhaltungsvolumen trainiert.`,
    })
  }

  const top = MUSCLE_SLUGS.filter(m => weeklySets[m] > 0)
    .sort((a, b) => weeklySets[b] - weeklySets[a])
    .slice(0, 5)
    .map(m => `${muscleGroup(m).nameDe}: ${weeklySets[m]}`)
  items.push({
    key: "volume",
    title: "Wöchentliche Arbeitssätze",
    body: `Geplant sind grob ${top.join(", ")} Arbeitssätze pro Woche (Nebenmuskeln zählen halb). Ziel war ${targets[profile.musclePriorities[0]?.muscle ?? "chest"]} für deine wichtigste Muskelgruppe. Aufwärmsätze zählen nicht mit.`,
  })

  const preferredUsed = sessions.flatMap(s => s.exercises).filter(e => profile.preferredExerciseIds.includes(e.exerciseId)).length
  if (profile.preferredExerciseIds.length) {
    items.push({
      key: "preferences",
      title: "Deine Übungsauswahl",
      body:
        preferredUsed > 0
          ? `${preferredUsed} deiner bevorzugten Übungen sind im Plan. Bevorzugte Übungen werden höher bewertet, überstimmen aber nicht die Ausgewogenheit zwischen den Muskelgruppen.`
          : "Deine bevorzugten Übungen passten nicht zu Equipment oder Zeitbudget. Du kannst jede Übung im Plan jederzeit austauschen.",
    })
  }
  if (profile.excludedExerciseIds.length) {
    items.push({ key: "excluded", title: "Ausgeschlossene Übungen", body: `${profile.excludedExerciseIds.length} Übungen wurden auf deinen Wunsch nicht berücksichtigt.` })
  }

  const avg = Math.round(sessions.reduce((a, s) => a + s.estimatedDurationMinutes, 0) / Math.max(1, sessions.length))
  items.push({
    key: "duration",
    title: "Trainingsdauer",
    body: `Jede Einheit ist auf etwa ${avg} Minuten ausgelegt (Budget: ${profile.sessionDurationMinutes} Minuten). Die Schätzung rechnet mit Satzdauer, Pausen, Aufwärmsätzen und Wechselzeiten.`,
  })

  const compounds = sessions.flatMap(s => s.exercises).filter(e => byId.get(e.exerciseId)?.category === "compound").length
  items.push({
    key: "order",
    title: "Reihenfolge",
    body: `${compounds} Grundübungen stehen jeweils am Anfang einer Einheit, Isolationsübungen und Rumpf folgen danach. Einheiten mit ähnlicher Belastung liegen nicht direkt hintereinander.`,
  })
  return items
}

/**
 * Generate a complete training plan. Deterministic: same inputs → same plan.
 */
export function generatePlan(profile: TrainingProfile, exercises: ExerciseRef[], opts: GeneratePlanOptions = {}): PlanDraft {
  const h = opts.heuristics ?? DEFAULT_HEURISTICS
  const frequency = Math.max(1, Math.min(7, Math.round(profile.weeklyFrequency)))
  const template = opts.splitType
    ? splitTemplate(opts.splitType, frequency, profile.primaryGoal, profile.experienceLevel)
    : suggestSplit(frequency, profile.primaryGoal, profile.experienceLevel)

  const byId = new Map(exercises.map(e => [e.id, e] as const))
  const targets = weeklySetTargets(profile, h)

  // Sessions per muscle → sets per session.
  const sessionsPerMuscle = emptyMuscleRecord()
  for (const s of template.sessions) for (const m of s.muscles) sessionsPerMuscle[m] += 1
  const setsPerSession = emptyMuscleRecord()
  for (const m of MUSCLE_SLUGS) setsPerSession[m] = sessionsPerMuscle[m] ? targets[m] / sessionsPerMuscle[m] : 0

  const planExerciseIds = new Set<string>()
  const continuity = new Set(opts.continuityIds ?? [])
  const familiar = new Set(opts.familiarIds ?? [])
  const sessions: PlanSessionDraft[] = []
  template.sessions.forEach((t, i) => {
    const s = buildSession({ template: t, sessionIndex: i, profile, exercises, byId, setsPerSession, planExerciseIds, continuity, familiar, h })
    for (const e of s.exercises) planExerciseIds.add(e.exerciseId)
    sessions.push(s)
  })

  const scheduled = assignWeekdays(sessions, opts.weekdays ?? profile.preferredWeekdays)
  const weeklySets = weeklySetsByMuscle({ sessions: scheduled }, id => byId.get(id), h.secondarySetCredit)

  return {
    name: opts.name ?? defaultPlanName(template.splitType, frequency),
    splitType: template.splitType,
    weeklyFrequency: frequency,
    sessions: scheduled,
    weeklySets,
    rationale: buildRationale(profile, template, scheduled, weeklySets, targets, byId),
  }
}

export function defaultPlanName(split: SplitType, frequency: number): string {
  const label: Record<SplitType, string> = {
    full_body: "Ganzkörper",
    upper_lower: "Ober-/Unterkörper",
    push_pull_legs: "Push/Pull/Legs",
    custom: "Individuell",
  }
  return `${label[split]} · ${frequency}× pro Woche`
}
