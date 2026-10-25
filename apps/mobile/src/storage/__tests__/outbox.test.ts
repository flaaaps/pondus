import type { SyncMutation } from "@pondus/shared"
import { createOutbox, memoryOutboxStorage } from "../outbox"

class NetErr extends Error {
  isNetwork = true
}
const m = (kind: string, i: number): SyncMutation => ({ kind: "pause", workoutClientId: `w${kind}${i}`, body: {} }) as SyncMutation

describe("outbox", () => {
  it("keeps entries on network failure and removes applied/duplicate ones", async () => {
    const box = createOutbox(memoryOutboxStorage())
    box.enqueue(m("a", 1), "1")
    box.enqueue(m("a", 2), "2")
    const offline = await box.flush(async () => Promise.reject(new NetErr("offline")), { isNetworkError: e => e instanceof NetErr })
    expect(offline.offline).toBe(true)
    expect(box.size()).toBe(2)
    const ok = await box.flush(async muts => ({ results: muts.map((_, index) => ({ index, status: index === 0 ? ("applied" as const) : ("duplicate" as const) })) }), { isNetworkError: () => false })
    expect(ok.applied).toBe(1)
    expect(ok.duplicates).toBe(1)
    expect(box.size()).toBe(0)
  })
  it("drops permanently rejected entries and reports them", async () => {
    const box = createOutbox(memoryOutboxStorage())
    box.enqueue(m("b", 1), "1")
    const r = await box.flush(async () => ({ results: [{ index: 0, status: "conflict" as const, message: "Workout is completed" }] }), { isNetworkError: () => false })
    expect(r.rejected).toHaveLength(1)
    expect(r.rejected[0]!.message).toBe("Workout is completed")
    expect(box.size()).toBe(0)
  })
  it("preserves order across enqueues", () => {
    const box = createOutbox(memoryOutboxStorage())
    for (let i = 0; i < 5; i++) box.enqueue(m("c", i), String(i))
    expect(box.peek().map(e => e.seq)).toEqual([1, 2, 3, 4, 5])
  })
  it("counts attempts on server errors without dropping", async () => {
    const box = createOutbox(memoryOutboxStorage())
    box.enqueue(m("d", 1), "1")
    await box.flush(async () => Promise.reject(new Error("500")), { isNetworkError: () => false })
    expect(box.size()).toBe(1)
    expect(box.peek()[0]!.attempts).toBe(1)
  })
})
