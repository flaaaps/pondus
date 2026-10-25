export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "AppError"
  }
}
export const notFound = (what = "Resource") => new AppError(404, "not_found", `${what} not found`)
export const forbidden = (message = "Forbidden") => new AppError(403, "forbidden", message)
export const unauthorized = (message = "Unauthorized") => new AppError(401, "unauthorized", message)
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details)
export const badRequest = (code: string, message: string, details?: unknown) => new AppError(400, code, message, details)
export const unprocessable = (code: string, message: string, details?: unknown) => new AppError(422, code, message, details)
