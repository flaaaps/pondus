export type WeightUnit = "kg" | "lb"
const LB_IN_GRAMS = 453.59237

export function gramsToUnit(grams: number, unit: WeightUnit): number {
  return unit === "kg" ? grams / 1000 : grams / LB_IN_GRAMS
}
export function unitToGrams(value: number, unit: WeightUnit): number {
  return Math.round(unit === "kg" ? value * 1000 : value * LB_IN_GRAMS)
}
export function formatWeight(grams: number | null, unit: WeightUnit, opts: { withUnit?: boolean } = {}): string {
  if (grams === null) return "–"
  const v = gramsToUnit(grams, unit)
  const text = Number.isInteger(v) ? String(v) : v.toFixed(unit === "kg" ? (Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2) : 1).replace(/\.?0+$/, "")
  return opts.withUnit === false ? text : `${text} ${unit}`
}
/** Round grams to the nearest plate-loadable step for the unit. */
export function roundToStep(grams: number, stepGrams: number): number {
  if (stepGrams <= 0) return grams
  return Math.round(grams / stepGrams) * stepGrams
}
