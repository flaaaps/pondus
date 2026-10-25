import type { MuscleSlug } from "./muscles"
import type { ExperienceLevel, Goal, SplitType } from "./types"

export interface SessionTemplate {
  name: string
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
  return Array.from({ length: count }, (_, i) => ({ name: names[i] ?? `Ganzkörper ${i + 1}`, muscles: FULL }))
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
          { name: "Push", muscles: PUSH },
          { name: "Pull", muscles: PULL },
          { name: "Legs", muscles: LEGS },
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
        { name: "Oberkörper A", muscles: UPPER },
        { name: "Unterkörper A", muscles: LOWER },
        { name: "Oberkörper B", muscles: [...UPPER].reverse() },
        { name: "Unterkörper B", muscles: [...LOWER].reverse() },
      ],
      explanation:
        "Vier Einheiten als Oberkörper/Unterkörper: Jede Muskelgruppe wird zweimal pro Woche trainiert, mit einem Tag Abstand zwischen ähnlichen Belastungen.",
    }
  }
  if (f === 5) {
    return {
      splitType: "custom",
      sessions: [
        { name: "Oberkörper", muscles: UPPER },
        { name: "Unterkörper", muscles: LOWER },
        { name: "Push", muscles: PUSH },
        { name: "Pull", muscles: PULL },
        { name: "Legs", muscles: LEGS },
      ],
      explanation:
        "Fünf Einheiten kombinieren Oberkörper/Unterkörper mit Push/Pull/Legs. So kommt jede Muskelgruppe auf zwei Einheiten pro Woche, ohne dass einzelne Tage überladen werden.",
    }
  }
  return {
    splitType: "push_pull_legs",
    sessions: [
      { name: "Push A", muscles: PUSH },
      { name: "Pull A", muscles: PULL },
      { name: "Legs A", muscles: LEGS },
      { name: "Push B", muscles: [...PUSH].reverse() },
      { name: "Pull B", muscles: [...PULL].reverse() },
      { name: "Legs B", muscles: [...LEGS].reverse() },
    ].slice(0, f),
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
        { name: "Oberkörper A", muscles: UPPER },
        { name: "Unterkörper A", muscles: LOWER },
        { name: "Oberkörper B", muscles: [...UPPER].reverse() },
        { name: "Unterkörper B", muscles: [...LOWER].reverse() },
      ]
      return {
        splitType,
        sessions: Array.from({ length: f }, (_, i) => cycle[i % 4]!).map((s, i) => (i >= 4 ? { ...s, name: `${s.name}+` } : s)),
        explanation: "Oberkörper und Unterkörper wechseln sich ab.",
      }
    }
    case "push_pull_legs": {
      const cycle: SessionTemplate[] = [
        { name: "Push", muscles: PUSH },
        { name: "Pull", muscles: PULL },
        { name: "Legs", muscles: LEGS },
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
