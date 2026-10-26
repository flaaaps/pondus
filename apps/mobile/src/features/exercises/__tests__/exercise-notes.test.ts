import type { ExerciseDto, SyncMutation } from "@pondus/shared"
import { effectiveNote, patchExerciseNote, queuedNoteIds, settleNotes } from "../exercise-notes"

const exercise = (id: string, note: string | null = null): ExerciseDto => ({
  id,
  slug: id,
  nameDe: id,
  nameEn: id,
  aliases: [],
  category: "compound",
  movementPattern: "horizontal_push",
  equipment: ["barbell"],
  loadType: "free_weight",
  difficulty: "beginner",
  isUnilateral: false,
  primaryMuscles: ["chest"],
  secondaryMuscles: [],
  description: null,
  cues: [],
  commonMistakes: [],
  isSystem: true,
  isFavorite: false,
  lastUsedAt: null,
  setSeconds: null,
  note,
  noteUpdatedAt: note ? "2026-10-20T10:00:00.000Z" : null,
})
const edit = { note: "Sitz 4", updatedAt: "2026-10-25T10:00:00.000Z" }

describe("effectiveNote", () => {
  it("prefers a queued local edit, also a queued delete", () => {
    expect(effectiveNote(exercise("a", "Sitz 3"), edit)).toBe("Sitz 4")
    expect(effectiveNote(exercise("a", "Sitz 3"), { note: null, updatedAt: edit.updatedAt })).toBeNull()
  })
  it("falls back to the server copy and tolerates exercises cached before notes existed", () => {
    expect(effectiveNote(exercise("a", "Sitz 3"), undefined)).toBe("Sitz 3")
    expect(effectiveNote({} as ExerciseDto, undefined)).toBeNull()
    expect(effectiveNote(undefined, undefined)).toBeNull()
  })
})

describe("queuedNoteIds / settleNotes", () => {
  const mutations: SyncMutation[] = [
    { kind: "pause", workoutClientId: "w1", body: {} },
    { kind: "set_exercise_note", exerciseId: "a", body: edit },
  ]
  it("finds exercises with a note edit still in the outbox", () => {
    expect([...queuedNoteIds(mutations)]).toEqual(["a"])
  })
  it("keeps queued edits pending and settles the rest", () => {
    const { keep, settled } = settleNotes({ a: edit, b: { note: null, updatedAt: edit.updatedAt } }, queuedNoteIds(mutations))
    expect(keep).toEqual({ a: edit })
    expect(settled).toEqual([["b", { note: null, updatedAt: edit.updatedAt }]])
  })
})

describe("patchExerciseNote", () => {
  it("patches a detail, a list, infinite pages and alternatives", () => {
    expect(patchExerciseNote(exercise("a"), "a", edit)).toMatchObject({ note: "Sitz 4", noteUpdatedAt: edit.updatedAt })
    const list = [exercise("a"), exercise("b")]
    const patchedList = patchExerciseNote(list, "a", edit)
    expect(patchedList[0]!.note).toBe("Sitz 4")
    expect(patchedList[1]).toBe(list[1])
    const pages = { pages: [{ items: [exercise("b")], nextCursor: "x", total: 2 }, { items: [exercise("a")], nextCursor: null, total: 2 }], pageParams: [undefined, "x"] }
    const patchedPages = patchExerciseNote(pages, "a", edit)
    expect(patchedPages.pages[1]!.items[0]!.note).toBe("Sitz 4")
    expect(patchedPages.pageParams).toBe(pages.pageParams)
    const alternatives = [{ exercise: exercise("a"), score: 1, reasons: [] }]
    expect(patchExerciseNote(alternatives, "a", edit)[0]!.exercise.note).toBe("Sitz 4")
  })
  it("returns the same reference when the exercise is not in the data", () => {
    const list = [exercise("b")]
    expect(patchExerciseNote(list, "a", edit)).toBe(list)
    const history = { items: [{ workoutId: "w", sets: [] }], nextCursor: null }
    expect(patchExerciseNote(history, "a", edit)).toBe(history)
  })
})
