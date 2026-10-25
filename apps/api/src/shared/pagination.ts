/** Opaque cursor helpers: base64url(JSON) so the client never parses it. */
export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}
export function decodeCursor<T>(cursor: string | undefined): T | null {
  if (!cursor) return null
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T
  } catch {
    return null
  }
}
