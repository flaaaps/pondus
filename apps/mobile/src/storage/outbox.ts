import type { SyncMutation } from "@pondus/shared"
import { getDb } from "./db"

export interface OutboxEntry {
  id: string
  seq: number
  mutation: SyncMutation
  createdAt: string
  attempts: number
  lastError: string | null
}

/** Storage abstraction so the queue logic is unit-testable without SQLite. */
export interface OutboxStorage {
  all(): OutboxEntry[]
  append(entry: OutboxEntry): void
  remove(ids: string[]): void
  markFailed(id: string, error: string): void
  nextSeq(): number
}

export function sqliteOutboxStorage(): OutboxStorage {
  const db = getDb()
  const parse = (r: { id: string; seq: number; kind: string; payload: string; created_at: string; attempts: number; last_error: string | null }): OutboxEntry => ({
    id: r.id,
    seq: r.seq,
    mutation: JSON.parse(r.payload) as SyncMutation,
    createdAt: r.created_at,
    attempts: r.attempts,
    lastError: r.last_error,
  })
  return {
    all: () => db.getAllSync<Parameters<typeof parse>[0]>("SELECT * FROM outbox ORDER BY seq ASC").map(parse),
    append: e => db.runSync("INSERT INTO outbox (id, seq, kind, payload, created_at, attempts, last_error) VALUES (?, ?, ?, ?, ?, 0, NULL)", [e.id, e.seq, e.mutation.kind, JSON.stringify(e.mutation), e.createdAt]),
    remove: ids => {
      if (!ids.length) return
      db.withTransactionSync(() => {
        for (const id of ids) db.runSync("DELETE FROM outbox WHERE id = ?", [id])
      })
    },
    markFailed: (id, error) => db.runSync("UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?", [error.slice(0, 500), id]),
    nextSeq: () => (db.getFirstSync<{ m: number | null }>("SELECT MAX(seq) AS m FROM outbox")?.m ?? 0) + 1,
  }
}

export function memoryOutboxStorage(): OutboxStorage {
  let entries: OutboxEntry[] = []
  return {
    all: () => [...entries].sort((a, b) => a.seq - b.seq),
    append: e => void entries.push(e),
    remove: ids => (entries = entries.filter(e => !ids.includes(e.id))),
    markFailed: (id, error) => {
      const e = entries.find(x => x.id === id)
      if (e) {
        e.attempts += 1
        e.lastError = error
      }
    },
    nextSeq: () => entries.reduce((m, e) => Math.max(m, e.seq), 0) + 1,
  }
}

export interface FlushResult {
  sent: number
  applied: number
  duplicates: number
  /** Entries the server rejected permanently (conflict / error) – removed from the queue, reported to the user. */
  rejected: { entry: OutboxEntry; message: string }[]
  /** Network failure: nothing removed. */
  offline: boolean
}

export type SyncSender = (mutations: SyncMutation[]) => Promise<{ results: { index: number; status: "applied" | "duplicate" | "conflict" | "error"; message?: string }[] }>

/**
 * Append-only queue of workout mutations, flushed in order as one batch.
 * Idempotent on the server, so partial failures are safe to retry.
 */
export function createOutbox(storage: OutboxStorage) {
  return {
    size: () => storage.all().length,
    peek: () => storage.all(),
    enqueue(mutation: SyncMutation, id: string): OutboxEntry {
      const entry: OutboxEntry = { id, seq: storage.nextSeq(), mutation, createdAt: new Date().toISOString(), attempts: 0, lastError: null }
      storage.append(entry)
      return entry
    },
    async flush(send: SyncSender, opts: { maxBatch?: number; isNetworkError: (err: unknown) => boolean }): Promise<FlushResult> {
      const entries = storage.all().slice(0, opts.maxBatch ?? 200)
      const result: FlushResult = { sent: entries.length, applied: 0, duplicates: 0, rejected: [], offline: false }
      if (!entries.length) return result
      let response: Awaited<ReturnType<SyncSender>>
      try {
        response = await send(entries.map(e => e.mutation))
      } catch (err) {
        if (opts.isNetworkError(err)) {
          result.offline = true
          return result
        }
        // Server-side failure of the whole batch (5xx): keep entries, count an attempt.
        for (const e of entries) storage.markFailed(e.id, err instanceof Error ? err.message : String(err))
        return result
      }
      const done: string[] = []
      for (const r of response.results) {
        const entry = entries[r.index]
        if (!entry) continue
        if (r.status === "applied") result.applied += 1
        else if (r.status === "duplicate") result.duplicates += 1
        else result.rejected.push({ entry, message: r.message ?? r.status })
        done.push(entry.id)
      }
      storage.remove(done)
      return result
    },
    clear: () => storage.remove(storage.all().map(e => e.id)),
  }
}
export type Outbox = ReturnType<typeof createOutbox>
