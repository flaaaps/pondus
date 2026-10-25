import { z } from "zod"

export const email = z.email().max(254).transform(v => v.trim().toLowerCase())
export const password = z.string().min(8).max(128)

export const registerBody = z.object({
  email,
  password,
  displayName: z.string().trim().min(1).max(60),
})
export const loginBody = z.object({ email, password })
export const refreshBody = z.object({ refreshToken: z.string().min(20) })
export const logoutBody = z.object({ refreshToken: z.string().min(20).optional() })

export const userDto = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
  onboardingCompletedAt: z.string().nullable(),
  weightUnit: z.enum(["kg", "lb"]),
  locale: z.string(),
})
export type UserDto = z.infer<typeof userDto>

export const tokenPair = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.string(),
})
export const authResponse = z.object({ user: userDto, tokens: tokenPair })
export type AuthResponse = z.infer<typeof authResponse>
export type TokenPair = z.infer<typeof tokenPair>
