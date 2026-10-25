/**
 * Creates a demo account with a plan and several weeks of believable training
 * history, for screenshots and demos. Development only; talks to a running API
 * over HTTP, so plans, progression targets and records come from the real logic.
 * Usage: DEMO_API_URL=http://127.0.0.1:4010 pnpm db:create-demo-account [weeks]
 * Re-running deletes the previous demo account first.
 */
import { randomUUID } from "node:crypto"

const API = (process.env.DEMO_API_URL ?? "http://127.0.0.1:4010").replace(/\/$/, "")
if (process.env.NODE_ENV === "production" || /jupi|pondus\.(app|fit)/.test(API))
  throw new Error(`Refusing to create demo data on ${API}`)
const EMAIL = "demo@pondus.local"
const PASSWORD = "pondus-demo-1234"
const WEEKS = Number(process.argv[2] ?? 6)
/** Monday, Wednesday, Friday, Sunday (0 = Sunday). */
const WEEKDAYS = [1, 3, 5, 0]

type Json = Record<string, unknown>
let token = ""

async function call<T = Json>(method: string, path: string, body?: unknown): Promise<T> {
  for (;;) {
    const res = await request(method, path, body)
    if (res.status !== 429) return res.json as T
    // The API rate-limits per user; wait for the window to pass.
    const wait = Number(/retry in (\d+)/.exec(res.text)?.[1] ?? 30)
    console.log(`  Rate limit, warte ${wait} s …`)
    await new Promise(r => setTimeout(r, (wait + 1) * 1000))
  }
}

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok && res.status !== 429)
    throw Object.assign(new Error(`${method} ${path} → ${res.status} ${text}`), {
      status: res.status,
      body: text,
    })
  return { status: res.status, text, json: text ? (JSON.parse(text) as unknown) : null }
}

interface Exercise {
  id: string
  slug: string
  category: string
  loadType: string
  equipment: string[]
}
interface WorkoutSet {
  clientId: string | null
  id: string
  setNumber: number
  setType: string
  weightGrams: number | null
  reps: number | null
  targetWeightGrams: number | null
  targetReps: number | null
}
interface WorkoutExercise {
  id: string
  clientId: string | null
  exerciseId: string | null
  targetRepsMin: number | null
  targetRepsMax: number | null
  targetRir: number | null
  sets: WorkoutSet[]
}
interface Workout {
  id: string
  clientId: string | null
  exercises: WorkoutExercise[]
}

const exerciseCache = new Map<string, Exercise>()
async function exercise(id: string) {
  if (!exerciseCache.has(id)) exerciseCache.set(id, await call<Exercise>("GET", `/exercises/${id}`))
  return exerciseCache.get(id)!
}

/** Plausible first working weight for someone with a year or two of training (grams). */
function startingWeight(e: Exercise): number | null {
  const s = e.slug
  if (e.loadType === "bodyweight") return null
  if (e.loadType === "assisted") return 25000
  if (/deadlift|kreuzheben/.test(s)) return 100000
  if (/squat|kniebeuge|leg-press|beinpresse/.test(s))
    return e.equipment.includes("machine") ? 140000 : 80000
  if (/bench|bankdr/.test(s)) return e.equipment.includes("dumbbell") ? 26000 : 70000
  if (/row|rudern/.test(s)) return e.equipment.includes("dumbbell") ? 28000 : 60000
  if (/overhead|shoulder-press|military/.test(s))
    return e.equipment.includes("dumbbell") ? 18000 : 40000
  if (/hip-thrust/.test(s)) return 90000
  if (/curl/.test(s))
    return e.equipment.includes("barbell") || e.equipment.includes("ez_bar") ? 25000 : 12000
  if (/lateral|seitheben|fly|flye/.test(s)) return e.equipment.includes("dumbbell") ? 10000 : 20000
  if (/calf|waden/.test(s)) return 60000
  if (e.category === "compound") return e.equipment.includes("dumbbell") ? 22000 : 50000
  return e.equipment.includes("dumbbell") ? 12000 : 30000
}

const round = (grams: number, step: number) => Math.max(step, Math.round(grams / step) * step)

/** Deterministic "random" so re-runs give the same history. */
let seed = 7
const chance = (p: number) => {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280 < p
}

/** Per exercise: current working weight (grams, null = bodyweight) and reps per set. */
const progress: Record<string, { weight: number | null; reps: number }> = {}

async function advance(w: Workout) {
  for (const ex of w.exercises) {
    if (!ex.exerciseId) continue
    const meta = await exercise(ex.exerciseId)
    const state = progress[ex.exerciseId]!
    const min = ex.targetRepsMin ?? 8
    const max = ex.targetRepsMax ?? Math.max(min, 12)
    const step = meta.equipment.includes("dumbbell") ? 2000 : 2500
    if (state.reps < max) state.reps = Math.min(max, state.reps + (max - min >= 4 ? 2 : 1))
    else if (state.weight !== null) {
      // Assisted exercises get harder with less assistance.
      state.weight =
        meta.loadType === "assisted" ? Math.max(0, state.weight - step) : state.weight + step
      state.reps = min
    }
  }
}

async function logWorkout(planSessionId: string, startedAt: Date) {
  const w = await call<Workout>("POST", "/workouts", {
    clientId: randomUUID(),
    source: { type: "plan_session", planSessionId },
    startedAt: startedAt.toISOString(),
  })
  let at = startedAt.getTime() + 4 * 60_000
  // All sets of the workout go in one sync batch, like the app sends them after training offline.
  const mutations: unknown[] = []
  for (const ex of w.exercises) {
    if (!ex.exerciseId) continue
    const meta = await exercise(ex.exerciseId)
    const step = meta.equipment.includes("dumbbell") ? 2000 : 2500
    const min = ex.targetRepsMin ?? 8
    const max = ex.targetRepsMax ?? Math.max(min, 12)
    const targetRir = ex.targetRir ?? 2
    // Double progression as Pondus recommends it: reps climb through the range, then the load goes up.
    // Exercises start at different points of their rep range, so on any given day some are due for more load
    // and others for more reps. The first exercise of a session starts at the bottom.
    const stepReps = max - min >= 4 ? 2 : 1
    const offset = (w.exercises.indexOf(ex) % 3) * stepReps
    const state = (progress[ex.exerciseId] ??= {
      weight: startingWeight(meta),
      reps: Math.min(max, min + offset),
    })
    const atTop = state.reps >= max
    const working = ex.sets.filter(s => s.setType !== "warmup")
    for (const s of ex.sets) {
      const warmup = s.setType === "warmup"
      const isLast = s === working[working.length - 1]
      const weight =
        state.weight === null
          ? null
          : warmup
            ? round(state.weight * (s.setNumber === 1 ? 0.5 : 0.75), step)
            : state.weight
      // Below the top of the range later sets often fall a rep short, as they do in real training.
      const index = working.indexOf(s)
      const reps = warmup
        ? s.setNumber === 1
          ? 10
          : 6
        : !atTop && index > 0 && chance(isLast ? 0.6 : 0.35)
          ? Math.max(min, state.reps - 1)
          : state.reps
      const rir = warmup ? null : targetRir
      at += warmup ? 90_000 : 150_000
      const completedAt = new Date(at).toISOString()
      mutations.push({
        kind: "upsert_set",
        workoutClientId: w.clientId ?? w.id,
        exerciseClientId: ex.clientId ?? ex.id,
        body: {
          clientId: s.clientId ?? s.id,
          setNumber: s.setNumber,
          setType: s.setType,
          weightGrams: weight,
          reps,
          rir,
          completed: true,
          completedAt,
          updatedAt: completedAt,
        },
      })
    }
    at += 60_000
  }
  const sync = await call<{ results: { status: string; message?: string }[] }>(
    "POST",
    "/sync/workouts",
    { mutations },
  )
  const failed = sync.results.filter(r => r.status !== "applied" && r.status !== "duplicate")
  if (failed.length) throw new Error(`Sync rejected ${failed.length} sets: ${failed[0]?.message}`)
  const summary = await call<{ records: unknown[]; workingSets: number }>(
    "POST",
    `/workouts/${w.id}/complete`,
    { completedAt: new Date(at).toISOString() },
  )
  await advance(w)
  return summary
}

/** Training dates of the last `weeks` weeks on the plan's weekdays, oldest first, ending yesterday. */
function trainingDates(weeks: number): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (
    let d = new Date(today.getTime() - weeks * 7 * 86_400_000);
    d < today;
    d = new Date(d.getTime() + 86_400_000)
  ) {
    if (WEEKDAYS.includes(d.getDay()))
      dates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, chance(0.5) ? 5 : 20))
  }
  return dates
}

async function main() {
  try {
    const login = await call<{ tokens: { accessToken: string } }>("POST", "/auth/login", {
      email: EMAIL,
      password: PASSWORD,
    })
    token = login.tokens.accessToken
    await call("DELETE", "/me")
    token = ""
    console.log("Previous demo account deleted")
  } catch (e) {
    if ((e as { status?: number }).status !== 401) throw e
  }
  const reg = await call<{ tokens: { accessToken: string } }>("POST", "/auth/register", {
    email: EMAIL,
    password: PASSWORD,
    displayName: "Alex",
  })
  token = reg.tokens.accessToken

  await call("PUT", "/me/profile", {
    primaryGoal: "hypertrophy",
    secondaryGoals: ["strength"],
    experienceLevel: "intermediate",
    sessionDurationMinutes: 60,
    weeklyFrequency: 4,
    environment: "full_gym",
    preferredWeekdays: WEEKDAYS,
    musclePriorities: [
      { muscle: "chest", priority: 1 },
      { muscle: "back", priority: 2 },
    ],
  })
  await call("PATCH", "/me", { onboardingCompleted: true, weightUnit: "kg" })
  const plan = await call<{
    name: string
    currentVersion: { sessions: { id: string; name: string; weekday: number | null }[] }
  }>("POST", "/plans/generate", {})
  const sessions = plan.currentVersion.sessions
  console.log(`Plan „${plan.name}“: ${sessions.map(s => s.name).join(", ")}`)

  const dates = trainingDates(WEEKS)
  let records = 0
  for (const [i, date] of dates.entries()) {
    // One missed day in the middle keeps the history honest (not on today's weekday, so today's session has full history).
    if (i === Math.floor(dates.length / 2) && date.getDay() !== new Date().getDay()) continue
    // The session the plan puts on this weekday, so the week view and the history line up.
    const session =
      sessions.find(s => s.weekday === date.getDay()) ?? sessions[i % sessions.length]!
    const summary = await logWorkout(session.id, date)
    records += summary.records.length
    console.log(
      `${date.toISOString().slice(0, 10)}  ${session.name.padEnd(28)} ${summary.workingSets} Sätze, ${summary.records.length} Rekorde`,
    )
  }
  console.log(
    `\nDemo-Konto: ${EMAIL} / ${PASSWORD} · ${dates.length - 1} Workouts · ${records} Rekorde`,
  )
}

await main()
