import type { MuscleSlug } from "./muscles"
import type { ExerciseCategory, ExperienceLevel, Goal, MovementPattern, SplitType } from "./types"

/** German display labels for split types (UI, plan names, adjustment diffs). */
export const SPLIT_LABELS: Record<SplitType, string> = {
  full_body: "Ganzkörper",
  upper_lower: "Ober-/Unterkörper",
  push_pull_legs: "Push/Pull/Legs",
  custom: "Individuell",
}

/** Session "type"; sessions of the same kind (Oberkörper A/B) are siblings and should vary their main exercises. */
export type SessionKind = "full" | "upper" | "lower" | "push" | "pull" | "legs"

export interface SessionTemplate {
  name: string
  kind: SessionKind
  /** Muscles this session is responsible for, in order of priority. */
  muscles: MuscleSlug[]
}

export interface SplitTemplate {
  splitType: SplitType
  sessions: SessionTemplate[]
  /** Plain-language explanation shown to the user. */
  explanation: string
}

const UPPER: MuscleSlug[] = ["back", "chest", "shoulders", "biceps", "triceps"]
const LOWER: MuscleSlug[] = ["quads", "hamstrings", "glutes", "calves", "abs", "lower_back"]
const PUSH: MuscleSlug[] = ["chest", "shoulders", "triceps"]
const PULL: MuscleSlug[] = ["back", "biceps", "forearms", "lower_back"]
const LEGS: MuscleSlug[] = ["quads", "hamstrings", "glutes", "calves", "abs"]
const FULL: MuscleSlug[] = ["quads", "back", "chest", "hamstrings", "shoulders", "glutes", "biceps", "triceps", "abs", "calves"]

function fullBody(count: number): SessionTemplate[] {
  const names = ["Ganzkörper A", "Ganzkörper B", "Ganzkörper C", "Ganzkörper D"]
  return Array.from({ length: count }, (_, i) => ({ name: names[i] ?? `Ganzkörper ${i + 1}`, kind: "full" as const, muscles: FULL }))
}

/**
 * Pick a split for a weekly frequency. The choice is a suggestion; the user
 * can override it with any split type the planner supports.
 */
export function suggestSplit(frequency: number, goal: Goal, experience: ExperienceLevel): SplitTemplate {
  const f = Math.max(1, Math.min(7, Math.round(frequency)))
  if (f <= 2) {
    return {
      splitType: "full_body",
      sessions: fullBody(f),
      explanation:
        "Bei ein bis zwei Einheiten pro Woche trainiert jede Einheit den ganzen Körper. So wird jede Muskelgruppe trotzdem regelmäßig gereizt.",
    }
  }
  if (f === 3) {
    if (experience === "advanced" && goal === "hypertrophy") {
      return {
        splitType: "push_pull_legs",
        sessions: [
          { name: "Push", kind: "push", muscles: PUSH },
          { name: "Pull", kind: "pull", muscles: PULL },
          { name: "Legs", kind: "legs", muscles: LEGS },
        ],
        explanation:
          "Drei Einheiten als Push/Pull/Legs: Jede Einheit konzentriert sich auf eine Bewegungsrichtung, sodass du pro Muskelgruppe mehr Sätze in einer Einheit unterbringst.",
      }
    }
    return {
      splitType: "full_body",
      sessions: fullBody(3),
      explanation:
        "Drei Ganzkörpereinheiten treffen jede Muskelgruppe dreimal pro Woche. Für die meisten Ziele ist das bei drei Terminen die effizienteste Verteilung.",
    }
  }
  if (f === 4) {
    return {
      splitType: "upper_lower",
      sessions: [
        { name: "Oberkörper A", kind: "upper", muscles: UPPER },
        { name: "Unterkörper A", kind: "lower", muscles: LOWER },
        { name: "Oberkörper B", kind: "upper", muscles: [...UPPER].reverse() },
        { name: "Unterkörper B", kind: "lower", muscles: [...LOWER].reverse() },
      ],
      explanation:
        "Vier Einheiten als Oberkörper/Unterkörper: Jede Muskelgruppe wird zweimal pro Woche trainiert, mit einem Tag Abstand zwischen ähnlichen Belastungen.",
    }
  }
  if (f === 5) {
    return {
      splitType: "custom",
      sessions: [
        { name: "Oberkörper", kind: "upper", muscles: UPPER },
        { name: "Unterkörper", kind: "lower", muscles: LOWER },
        { name: "Push", kind: "push", muscles: PUSH },
        { name: "Pull", kind: "pull", muscles: PULL },
        { name: "Legs", kind: "legs", muscles: LEGS },
      ],
      explanation:
        "Fünf Einheiten kombinieren Oberkörper/Unterkörper mit Push/Pull/Legs. So kommt jede Muskelgruppe auf zwei Einheiten pro Woche, ohne dass einzelne Tage überladen werden.",
    }
  }
  return {
    splitType: "push_pull_legs",
    sessions: ([
      { name: "Push A", kind: "push", muscles: PUSH },
      { name: "Pull A", kind: "pull", muscles: PULL },
      { name: "Legs A", kind: "legs", muscles: LEGS },
      { name: "Push B", kind: "push", muscles: [...PUSH].reverse() },
      { name: "Pull B", kind: "pull", muscles: [...PULL].reverse() },
      { name: "Legs B", kind: "legs", muscles: [...LEGS].reverse() },
    ] satisfies SessionTemplate[]).slice(0, f),
    explanation:
      "Sechs Einheiten als doppeltes Push/Pull/Legs: Jede Muskelgruppe wird zweimal pro Woche mit hohem Fokus trainiert.",
  }
}

/** Build a template for an explicitly requested split type. */
export function splitTemplate(splitType: SplitType, frequency: number, goal: Goal, experience: ExperienceLevel): SplitTemplate {
  const f = Math.max(1, Math.min(7, Math.round(frequency)))
  switch (splitType) {
    case "full_body":
      return { splitType, sessions: fullBody(f), explanation: "Jede Einheit trainiert den ganzen Körper." }
    case "upper_lower": {
      const cycle: SessionTemplate[] = [
        { name: "Oberkörper A", kind: "upper", muscles: UPPER },
        { name: "Unterkörper A", kind: "lower", muscles: LOWER },
        { name: "Oberkörper B", kind: "upper", muscles: [...UPPER].reverse() },
        { name: "Unterkörper B", kind: "lower", muscles: [...LOWER].reverse() },
      ]
      return {
        splitType,
        sessions: Array.from({ length: f }, (_, i) => cycle[i % 4]!).map((s, i) => (i >= 4 ? { ...s, name: `${s.name}+` } : s)),
        explanation: "Oberkörper und Unterkörper wechseln sich ab.",
      }
    }
    case "push_pull_legs": {
      const cycle: SessionTemplate[] = [
        { name: "Push", kind: "push", muscles: PUSH },
        { name: "Pull", kind: "pull", muscles: PULL },
        { name: "Legs", kind: "legs", muscles: LEGS },
      ]
      return {
        splitType,
        sessions: Array.from({ length: f }, (_, i) => {
          const base = cycle[i % 3]!
          return { ...base, name: f > 3 ? `${base.name} ${i < 3 ? "A" : "B"}` : base.name }
        }),
        explanation: "Drücken, Ziehen und Beine werden auf getrennte Einheiten verteilt.",
      }
    }
    case "custom":
    default:
      return suggestSplit(f, goal, experience)
  }
}

/**
 * A movement the plan must contain regardless of how the muscle budget works
 * out (e.g. a knee-flexion curl: hinges alone under-train the short head of
 * the hamstrings; lateral raises: pressing barely hits the side delts).
 */
export interface RequiredSlot {
  key: "knee_flexion" | "lateral_raise" | "core" | "calves"
  label: string
  muscle: MuscleSlug
  patterns: MovementPattern[]
  categories: ExerciseCategory[]
  /** How many sessions per week get this slot. */
  perWeek: number
}

/** Plan-wide mandatory slots for a split, with weekly frequency. */
export function requiredSlots(template: Pick<SplitTemplate, "sessions">): RequiredSlot[] {
  const count = (m: MuscleSlug) => template.sessions.filter(s => s.muscles.includes(m)).length
  const isFullBody = template.sessions.every(s => s.kind === "full")
  const slots: RequiredSlot[] = [
    { key: "knee_flexion", label: "Beinbeuger-Curl", muscle: "hamstrings", patterns: ["knee_flexion"], categories: ["isolation"], perWeek: Math.min(2, count("hamstrings")) },
    { key: "lateral_raise", label: "Seitheben", muscle: "shoulders", patterns: ["shoulder_abduction"], categories: ["isolation"], perWeek: Math.min(2, count("shoulders")) },
    { key: "core", label: "Rumpf", muscle: "abs", patterns: ["trunk_flexion", "anti_extension", "anti_rotation", "lateral_flexion"], categories: ["core"], perWeek: Math.min(2, count("abs")) },
    {
      key: "calves",
      label: "Waden",
      muscle: "calves",
      patterns: ["plantar_flexion"],
      categories: ["isolation"],
      perWeek: Math.min(isFullBody && template.sessions.length <= 3 ? 1 : 2, count("calves")),
    },
  ]
  return slots.filter(s => s.perWeek > 0)
}

/**
 * Distribute the required slots over the sessions: each slot goes to sessions
 * that train its muscle, least-loaded session first, spread out across the week.
 * Returns one list of slots per session (same order as `template.sessions`).
 */
export function assignRequiredSlots(template: Pick<SplitTemplate, "sessions">): RequiredSlot[][] {
  const n = template.sessions.length
  const out: RequiredSlot[][] = template.sessions.map(() => [])
  for (const slot of requiredSlots(template)) {
    const holders: number[] = []
    for (let k = 0; k < slot.perWeek; k++) {
      const candidates = template.sessions
        .map((s, i) => ({ s, i }))
        .filter(({ s, i }) => s.muscles.includes(slot.muscle) && !holders.includes(i))
      const dist = (i: number) => (holders.length ? Math.min(...holders.map(h => Math.min(Math.abs(h - i), n - Math.abs(h - i)))) : 0)
      candidates.sort((a, b) => out[a.i]!.length - out[b.i]!.length || dist(b.i) - dist(a.i) || a.i - b.i)
      const pick = candidates[0]
      if (!pick) break
      holders.push(pick.i)
      out[pick.i]!.push(slot)
    }
  }
  return out
}
