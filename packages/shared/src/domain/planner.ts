import { estimateSessionMinutes } from "./duration"
import { DEFAULT_HEURISTICS, isHipIsolation, prescriptionForExercise, type PlanningHeuristics } from "./heuristics"
import { MUSCLE_SLUGS, muscleGroup, type MuscleSlug } from "./muscles"
import { assignWeekdays } from "./schedule"
import { DIFFICULTY_RANK, rankExercises, type ScoringContext } from "./scoring"
import {
  SPLIT_LABELS,
  assignRequiredSlots,
  splitTemplate,
  suggestSplit,
  type RequiredSlot,
  type SessionKind,
  type SessionTemplate,
  type SplitTemplate,
} from "./splits"
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
/** Muscles usually trained with isolation / core work rather than a main compound. */
const SMALL_MUSCLES: MuscleSlug[] = ["biceps", "triceps", "calves", "forearms", "abs", "lower_back"]

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

/** Weekly cap per muscle: the planner never exceeds this (plan-wide, primary + secondary credit). */
export function weeklySetCaps(targets: Record<MuscleSlug, number>, h: PlanningHeuristics = DEFAULT_HEURISTICS): Record<MuscleSlug, number> {
  const out = emptyMuscleRecord()
  for (const m of MUSCLE_SLUGS) out[m] = targets[m] > 0 ? Math.max(targets[m] + 1, Math.round(targets[m] * h.weeklyCapFactor)) : 0
  return out
}

/** Shared, plan-wide state while sessions are built one after another. */
interface PlanState {
  targets: Record<MuscleSlug, number>
  caps: Record<MuscleSlug, number>
  /** Credit from sessions already built. */
  planCredit: Record<MuscleSlug, number>
  /** Sessions (including the current one) that still train the muscle. */
  sessionsLeft: Record<MuscleSlug, number>
  planExerciseIds: Set<string>
  planPatternCounts: Map<ExerciseRef["movementPattern"], number>
  idsByKind: Map<SessionKind, Set<string>>
}

interface BuildSessionInput {
  template: SessionTemplate
  sessionIndex: number
  required: RequiredSlot[]
  profile: TrainingProfile
  exercises: ExerciseRef[]
  byId: Map<string, ExerciseRef>
  state: PlanState
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

/** Movement family used for warm-up decisions: one warm-up block per family and session. */
function warmupFamily(pattern: ExerciseRef["movementPattern"]): string {
  switch (pattern) {
    case "horizontal_push":
    case "vertical_push":
      return "push"
    case "horizontal_pull":
    case "vertical_pull":
      return "pull"
    case "squat":
    case "lunge":
      return "knee"
    case "hinge":
    case "hip_extension":
      return "hip"
    default:
      return pattern
  }
}

/**
 * Warm-ups only for the first main exercise of each movement family in a session:
 * the very first compound gets `warmupSetsForFirstCompounds`, the first compound of
 * every further family `warmupSetsForFollowingPatterns`, everything else 0.
 * Hip isolation (hip thrusts, pull-throughs) and bodyweight lifts never get warm-ups.
 */
export function assignWarmups(
  ordered: PlanExerciseDraft[],
  byId: Map<string, ExerciseRef>,
  h: PlanningHeuristics = DEFAULT_HEURISTICS,
): PlanExerciseDraft[] {
  const warmed = new Set<string>()
  return ordered.map(d => {
    const ref = byId.get(d.exerciseId)
    if (!ref || ref.category !== "compound" || isHipIsolation(ref) || ref.loadType === "bodyweight") return { ...d, warmupSets: 0 }
    const family = warmupFamily(ref.movementPattern)
    if (warmed.has(family)) return { ...d, warmupSets: 0 }
    const sets = warmed.size === 0 ? h.warmupSetsForFirstCompounds : h.warmupSetsForFollowingPatterns
    warmed.add(family)
    return { ...d, warmupSets: sets }
  })
}

function clampSets(n: number, h: PlanningHeuristics): number {
  return Math.max(h.setsPerExercise.min, Math.min(h.setsPerExercise.max, Math.round(n)))
}

function buildSession(input: BuildSessionInput): { session: PlanSessionDraft; requiredIds: Set<string> } {
  const { template, profile, exercises, byId, state, continuity, familiar, h, required } = input
  const available = new Set(profile.availableEquipment)
  const focus = new Set(profile.musclePriorities.map(p => p.muscle))
  const preferred = new Set(profile.preferredExerciseIds)
  const excluded = new Set(profile.excludedExerciseIds)
  const discouraged = new Set(h.discouragedExerciseSlugs)
  const sessionMuscles = new Set(template.muscles)
  const siblings = state.idsByKind.get(template.kind) ?? new Set<string>()
  const maxExercises = h.maxExercisesPerSession[profile.experienceLevel]

  const chosen: PlanExerciseDraft[] = []
  const requiredIds = new Set<string>()
  const sessionPatterns = new Set<ExerciseRef["movementPattern"]>()
  const sessionIds = new Set<string>()
  const credit = emptyMuscleRecord()
  const patternCounts = new Map(state.planPatternCounts)

  const total = (m: MuscleSlug) => state.planCredit[m] + credit[m]
  const ctx = (muscle: MuscleSlug, wantCompound: boolean): ScoringContext => ({
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
    planExerciseIds: state.planExerciseIds,
    wantCompound,
    sessionMuscles,
    siblingExerciseIds: siblings,
    planPatternCounts: patternCounts,
    patternLimitsPerWeek: h.patternLimitsPerWeek,
    muscleState: m => ({ credit: total(m), target: state.targets[m], cap: state.caps[m] }),
    discouragedSlugs: discouraged,
  })

  const add = (ex: ExerciseRef, sets: number) => {
    const p = prescriptionForExercise(ex, profile.primaryGoal, profile.experienceLevel, h)
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
    patternCounts.set(ex.movementPattern, (patternCounts.get(ex.movementPattern) ?? 0) + 1)
    for (const m of ex.primaryMuscles) credit[m] += sets
    for (const m of ex.secondaryMuscles) credit[m] += sets * h.secondarySetCredit
  }

  /** Sets that fit under the weekly cap of every primary muscle (null = does not fit at minimum sets). */
  const fit = (ex: ExerciseRef, desired: number): number | null => {
    let sets = desired
    for (const m of ex.primaryMuscles) sets = Math.min(sets, Math.floor(state.caps[m] - total(m) + 1e-9))
    return sets >= h.setsPerExercise.min ? sets : null
  }
  const pickFitting = (ranked: { exercise: ExerciseRef }[], desired: number) => {
    for (const r of ranked) {
      const sets = fit(r.exercise, desired)
      if (sets !== null) return { exercise: r.exercise, sets }
    }
    return null
  }

  /** What this session should still contribute: an even share of the remaining weekly budget. */
  const need = (m: MuscleSlug) => (state.targets[m] - state.planCredit[m]) / Math.max(1, state.sessionsLeft[m]) - credit[m]

  // Pass 0: mandatory movement slots (leg curl, lateral raise, core, calves). Cap is not enforced here.
  for (const slot of required) {
    if (chosen.length >= maxExercises) break
    // Mandatory, but never with an exercise two levels above the user (Nordic curls for beginners).
    const candidates = exercises.filter(
      e =>
        slot.patterns.includes(e.movementPattern) &&
        slot.categories.includes(e.category) &&
        DIFFICULTY_RANK[e.difficulty] - DIFFICULTY_RANK[profile.experienceLevel] < 2,
    )
    const pick = rankExercises(candidates, ctx(slot.muscle, false))[0]
    if (!pick) continue
    // Mandatory accessories get 2–3 sets; the plan-wide balancing pass tops up if the muscle stays short.
    const desired = Math.min(3, clampSets(need(slot.muscle), h))
    add(pick.exercise, desired)
    requiredIds.add(pick.exercise.id)
  }

  const muscles = orderMuscles(template.muscles, profile, h)

  // Pass 1: one main exercise per muscle that still needs work.
  const pass1 = (list: MuscleSlug[]) => {
    for (const muscle of list) {
      if (chosen.length >= maxExercises) break
      const remaining = need(muscle)
      if (remaining < 1) continue
      const wantCompound = !SMALL_MUSCLES.includes(muscle)
      const pick = pickFitting(rankExercises(exercises, ctx(muscle, wantCompound)), clampSets(remaining, h))
      if (pick) add(pick.exercise, pick.sets)
    }
  }
  // Pass 2: fill remaining deficits with a second (usually isolation) exercise, largest deficit first.
  const pass2 = (list: MuscleSlug[]) => {
    const deficits = list
      .map(m => ({ m, d: need(m) }))
      .filter(x => x.d >= 1.5)
      .sort((a, b) => b.d - a.d)
    for (const { m } of deficits) {
      if (chosen.length >= maxExercises) break
      const d = need(m)
      if (d < 1.5) continue
      const pick = pickFitting(rankExercises(exercises, ctx(m, false)), clampSets(d, h))
      if (pick) add(pick.exercise, pick.sets)
    }
  }
  // Big muscles first, then focus-muscle deficits (a second exercise for a focus muscle beats
  // arm isolation), then small muscles, then everything that is still short.
  pass1(muscles.filter(m => !SMALL_MUSCLES.includes(m)))
  pass2(muscles.filter(m => focus.has(m)))
  pass1(muscles.filter(m => SMALL_MUSCLES.includes(m)))
  pass2(muscles)

  const priorityOf = new Map(profile.musclePriorities.map(p => [p.muscle, p.priority] as const))
  let ordered = assignWarmups(sortSessionExercises(chosen, byId, h, priorityOf), byId, h)

  // Fit the time budget: trim sets from the end (isolation first), then drop exercises. Mandatory slots go last.
  const lookup = (id: string) => byId.get(id)
  const budget = profile.sessionDurationMinutes
  let guard = 0
  const trimRank = (d: PlanExerciseDraft, index: number) => {
    const ref = byId.get(d.exerciseId)
    const primary = ref?.primaryMuscles[0]
    const prio = primary ? (priorityOf.get(primary) ?? 50) : 50
    return prio * 1000 - (ref?.category === "compound" ? 100 : 0) - (requiredIds.has(d.exerciseId) ? 50_000 : 0) + d.targetSets * 10 - index
  }
  while (estimateSessionMinutes(ordered, lookup, h) > budget && ordered.length > 1 && guard++ < 100) {
    const candidates = ordered
      .map((d, i) => ({ d, i, r: trimRank(d, i) }))
      .filter(x => x.d.targetSets > h.setsPerExercise.min)
      .sort((a, b) => b.r - a.r)
    const pick = candidates[0]
    const pickPrimary = pick ? byId.get(pick.d.exerciseId)?.primaryMuscles[0] : undefined
    // Rather drop a non-focus accessory than cut a focus muscle's main work.
    const accessory =
      pickPrimary && focus.has(pickPrimary)
        ? ordered
            .map((d, i) => ({ d, i, ref: byId.get(d.exerciseId) }))
            .filter(x => x.ref && x.ref.category !== "compound" && !requiredIds.has(x.d.exerciseId) && !x.ref.primaryMuscles.some(m => focus.has(m)))
            .sort((a, b) => trimRank(b.d, b.i) - trimRank(a.d, a.i))[0]
        : undefined
    if (accessory && ordered.length > 4) {
      ordered = assignWarmups(
        ordered.filter((_, i) => i !== accessory.i).map((d, i) => ({ ...d, sequence: i + 1 })),
        byId,
        h,
      )
    } else if (pick) {
      ordered[pick.i] = { ...pick.d, targetSets: pick.d.targetSets - 1 }
    } else {
      const drop = ordered.map((d, i) => ({ i, r: trimRank(d, i) })).sort((a, b) => b.r - a.r)[0]!
      ordered = assignWarmups(
        ordered.filter((_, i) => i !== drop.i).map((d, i) => ({ ...d, sequence: i + 1 })),
        byId,
        h,
      )
    }
  }

  return {
    session: {
      name: template.name,
      sequence: input.sessionIndex + 1,
      weekday: null,
      focusMuscles: sessionFocus(ordered, byId),
      estimatedDurationMinutes: estimateSessionMinutes(ordered, lookup, h),
      exercises: ordered,
    },
    requiredIds,
  }
}

function sessionFocus(list: PlanExerciseDraft[], byId: Map<string, ExerciseRef>): MuscleSlug[] {
  return Array.from(new Set(list.flatMap(d => byId.get(d.exerciseId)?.primaryMuscles ?? [])))
}

/**
 * Plan-wide correction after all sessions are built: enforce the weekly cap
 * (remove sets, then whole non-mandatory exercises from over-served muscles) and
 * top up muscles clearly under target where the time budget allows.
 */
function balancePlan(
  sessions: PlanSessionDraft[],
  requiredBySession: Set<string>[],
  byId: Map<string, ExerciseRef>,
  targets: Record<MuscleSlug, number>,
  caps: Record<MuscleSlug, number>,
  profile: TrainingProfile,
  h: PlanningHeuristics,
): PlanSessionDraft[] {
  const lookup = (id: string) => byId.get(id)
  const out = sessions.map(s => ({ ...s, exercises: s.exercises.map(e => ({ ...e })) }))
  const weekly = () => weeklySetsByMuscle({ sessions: out }, lookup, h.secondarySetCredit)
  const entries = () =>
    out.flatMap((s, si) => s.exercises.map((e, ei) => ({ s, si, e, ei, ref: byId.get(e.exerciseId)! }))).filter(x => x.ref)

  /** Try to take one set (or one exercise) away from muscle `over`. Returns false if nothing can give. */
  const relieve = (over: MuscleSlug, w: Record<MuscleSlug, number>): boolean => {
    const primaryFor = entries()
      .filter(x => x.ref.primaryMuscles.includes(over))
      // Never starve another primary muscle well below its target to fix this one.
      .filter(x => x.ref.primaryMuscles.every(m => m === over || w[m] - 1 >= targets[m] * 0.8))
    // Secondary sources (rows → forearms, squats → glutes) may give a set back if their own primaries stay on target.
    const secondaryFor = entries()
      .filter(x => x.ref.secondaryMuscles.includes(over) && !x.ref.primaryMuscles.includes(over))
      .filter(x => x.ref.primaryMuscles.every(m => w[m] - 1 >= targets[m] * 0.9))
    // 1) remove a set: multi-primary (both credited) first, isolation before compound, most sets first;
    //    secondary sources only when no primary source can give.
    const r =
      primaryFor
        .filter(x => x.e.targetSets > h.setsPerExercise.min)
        .sort(
          (a, b) =>
            b.ref.primaryMuscles.length - a.ref.primaryMuscles.length ||
            (a.ref.category === "compound" ? 1 : 0) - (b.ref.category === "compound" ? 1 : 0) ||
            b.e.targetSets - a.e.targetSets ||
            b.ei - a.ei,
        )[0] ?? secondaryFor.filter(x => x.e.targetSets > h.setsPerExercise.min).sort((a, b) => b.e.targetSets - a.e.targetSets || b.ei - a.ei)[0]
    if (r) {
      r.e.targetSets -= 1
      return true
    }
    // 2) drop a non-mandatory exercise, keeping at least 3 per session.
    const d = primaryFor
      .filter(x => !requiredBySession[x.si]!.has(x.e.exerciseId) && x.s.exercises.length > 3)
      .sort((a, b) => (a.ref.category === "compound" ? 1 : 0) - (b.ref.category === "compound" ? 1 : 0) || b.ei - a.ei)[0]
    if (!d) return false
    out[d.si] = { ...d.s, exercises: d.s.exercises.filter((_, i) => i !== d.ei) }
    return true
  }

  for (let guard = 0; guard < 200; guard++) {
    const w = weekly()
    const over = MUSCLE_SLUGS.filter(m => w[m] > caps[m] + 1e-9).sort((a, b) => w[b] - caps[b] - (w[a] - caps[a]))
    if (!over.some(m => relieve(m, w))) break
  }

  // Top up clear deficits (≥ 1.5 sets under target) with an extra set if time and caps allow.
  for (let guard = 0; guard < 100; guard++) {
    const w = weekly()
    const under = MUSCLE_SLUGS.filter(m => targets[m] - w[m] >= 1.5).sort((a, b) => targets[b] - w[b] - (targets[a] - w[a]))
    let changed = false
    for (const m of under) {
      const cand = entries()
        .filter(x => x.ref.primaryMuscles.includes(m) && x.e.targetSets < h.setsPerExercise.max)
        .filter(x => x.ref.primaryMuscles.every(p => w[p] + 1 <= caps[p]))
        .filter(x => {
          const trial = x.s.exercises.map((e, i) => (i === x.ei ? { ...e, targetSets: e.targetSets + 1 } : e))
          return estimateSessionMinutes(trial, lookup, h) <= profile.sessionDurationMinutes
        })
        .sort((a, b) => a.ref.primaryMuscles.length - b.ref.primaryMuscles.length || a.e.targetSets - b.e.targetSets || a.si - b.si)[0]
      if (cand) {
        cand.e.targetSets += 1
        changed = true
        break
      }
    }
    if (!changed) break
  }

  return out.map(s => {
    const exercises = assignWarmups(s.exercises.map((e, i) => ({ ...e, sequence: i + 1 })), byId, h)
    return { ...s, exercises, focusMuscles: sessionFocus(exercises, byId), estimatedDurationMinutes: estimateSessionMinutes(exercises, lookup, h) }
  })
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
  const caps = weeklySetCaps(targets, h)

  const sessionsLeft = emptyMuscleRecord()
  for (const s of template.sessions) for (const m of s.muscles) sessionsLeft[m] += 1
  const state: PlanState = {
    targets,
    caps,
    planCredit: emptyMuscleRecord(),
    sessionsLeft,
    planExerciseIds: new Set(),
    planPatternCounts: new Map(),
    idsByKind: new Map(),
  }
  const requiredPerSession = assignRequiredSlots(template)
  const continuity = new Set(opts.continuityIds ?? [])
  const familiar = new Set(opts.familiarIds ?? [])
  const built: PlanSessionDraft[] = []
  const requiredIds: Set<string>[] = []
  template.sessions.forEach((t, i) => {
    const { session, requiredIds: req } = buildSession({
      template: t,
      sessionIndex: i,
      required: requiredPerSession[i] ?? [],
      profile,
      exercises,
      byId,
      state,
      continuity,
      familiar,
      h,
    })
    for (const e of session.exercises) {
      const ref = byId.get(e.exerciseId)
      if (!ref) continue
      state.planExerciseIds.add(e.exerciseId)
      state.planPatternCounts.set(ref.movementPattern, (state.planPatternCounts.get(ref.movementPattern) ?? 0) + 1)
      for (const m of ref.primaryMuscles) state.planCredit[m] += e.targetSets
      for (const m of ref.secondaryMuscles) state.planCredit[m] += e.targetSets * h.secondarySetCredit
    }
    const kindIds = state.idsByKind.get(t.kind) ?? new Set<string>()
    for (const e of session.exercises) kindIds.add(e.exerciseId)
    state.idsByKind.set(t.kind, kindIds)
    for (const m of t.muscles) state.sessionsLeft[m] -= 1
    built.push(session)
    requiredIds.push(req)
  })
  const sessions = balancePlan(built, requiredIds, byId, targets, caps, profile, h)

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
  return `${SPLIT_LABELS[split]} · ${frequency}× pro Woche`
}
