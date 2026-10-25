import { formatDuration, formatTimer, formatTonnage, formatWeight, formatRecordValue } from "../format"

describe("format", () => {
  it("formats timers and durations", () => {
    expect(formatTimer(95)).toBe("1:35")
    expect(formatTimer(0)).toBe("0:00")
    expect(formatDuration(3700)).toBe("1 h 1 min")
    expect(formatDuration(2400)).toBe("40 min")
  })
  it("formats tonnage compactly", () => {
    expect(formatTonnage(850000, "kg")).toBe("850 kg")
    expect(formatTonnage(12400000, "kg")).toBe("12,4 t")
  })
})

describe("formatWeight and formatRecordValue", () => {
  it("uses a German decimal comma", () => {
    expect(formatWeight(92500, "kg")).toBe("92,5 kg")
  })
  it("shows reps at a weight and rounds estimates to 100 g", () => {
    expect(formatRecordValue({ type: "max_reps_at_weight", reps: 12, weightGrams: 80000, valueGrams: null, isEstimate: false }, "kg")).toBe("12 × 80 kg")
    expect(formatRecordValue({ type: "estimated_1rm", reps: null, weightGrams: null, valueGrams: 93333, isEstimate: true }, "kg")).toBe("93,3 kg")
    expect(formatRecordValue({ type: "max_weight", reps: null, weightGrams: 72500, valueGrams: 72500, isEstimate: false }, "kg")).toBe("72,5 kg")
  })
})
