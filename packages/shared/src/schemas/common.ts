import { z } from "zod"

export const uuid = z.uuid()
export const isoDateTime = z.iso.datetime({ offset: true })
export const idempotencyKey = z.string().min(8).max(128)

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})
export type PaginationQuery = z.infer<typeof paginationQuery>

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() })
}

export const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
})
export type ErrorResponse = z.infer<typeof errorResponse>

/** Weight is always transported as integer grams. */
export const weightGrams = z.number().int().min(0).max(2_000_000)
export const reps = z.number().int().min(0).max(500)
export const rir = z.number().int().min(0).max(10)
export const rpe = z.number().min(1).max(10)
