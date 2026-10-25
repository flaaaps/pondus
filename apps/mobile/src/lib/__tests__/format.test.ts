import { formatDuration, formatTimer, formatTonnage } from "../format"

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
