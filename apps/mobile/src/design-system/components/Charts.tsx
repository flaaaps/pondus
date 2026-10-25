import { useState } from "react"
import { View } from "react-native"
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg"
import { useTheme } from "../theme"
import { Text } from "./Text"

export interface ChartPoint {
  label: string
  value: number
  /** Optional secondary caption shown when selected. */
  caption?: string
}

/**
 * Minimal, legible bar chart for weekly volume / frequency. Pure SVG, no
 * extra dependency. Tapping a bar shows its value; the maximum is labelled.
 */
export function BarChart({ data, height = 140, formatValue = v => String(v), emptyLabel = "Noch keine Daten" }: { data: ChartPoint[]; height?: number; formatValue?: (v: number) => string; emptyLabel?: string }) {
  const { colors, typography } = useTheme()
  const [width, setWidth] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const max = Math.max(0, ...data.map(d => d.value))
  const padBottom = 22
  const padTop = 18
  const inner = height - padBottom - padTop
  const gap = 6
  const barW = data.length ? Math.max(4, (width - gap * (data.length - 1)) / data.length) : 0
  const sel = selected !== null ? data[selected] : undefined
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && data.length > 0 && max > 0 ? (
        <Svg width={width} height={height}>
          {[0.5, 1].map(f => (
            <Line key={f} x1={0} x2={width} y1={padTop + inner * (1 - f)} y2={padTop + inner * (1 - f)} stroke={colors.chartGrid} strokeWidth={1} />
          ))}
          {data.map((d, i) => {
            const h = (d.value / max) * inner
            const x = i * (barW + gap)
            const y = padTop + inner - h
            const isSel = selected === i
            const isMax = d.value === max
            return (
              <Rect
                key={d.label + i}
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx={Math.min(6, barW / 2)}
                fill={isSel || (selected === null && isMax) ? colors.chartPrimary : colors.chartMuted}
                onPress={() => setSelected(isSel ? null : i)}
              />
            )
          })}
          {data.map((d, i) =>
            data.length <= 8 || i % Math.ceil(data.length / 6) === 0 ? (
              <SvgText key={`l${i}`} x={i * (barW + gap) + barW / 2} y={height - 6} fontSize={typography.caption.fontSize} fill={colors.textTertiary} textAnchor="middle">
                {d.label}
              </SvgText>
            ) : null,
          )}
          {(sel ?? data.find(d => d.value === max)) ? (
            <SvgText x={(selected ?? data.findIndex(d => d.value === max)) * (barW + gap) + barW / 2} y={padTop - 6} fontSize={typography.caption.fontSize} fontWeight="600" fill={colors.textPrimary} textAnchor="middle">
              {formatValue((sel ?? data.find(d => d.value === max))!.value)}
            </SvgText>
          ) : null}
        </Svg>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text variant="footnote" color="tertiary">
            {emptyLabel}
          </Text>
        </View>
      )}
    </View>
  )
}

/** Line chart for a single exercise's top set / e1RM trend. */
export function LineChart({ data, height = 160, formatValue = v => String(v), emptyLabel = "Noch keine Daten" }: { data: ChartPoint[]; height?: number; formatValue?: (v: number) => string; emptyLabel?: string }) {
  const { colors, typography } = useTheme()
  const [width, setWidth] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const padX = 8
  const padTop = 20
  const padBottom = 22
  const inner = height - padTop - padBottom
  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const xFor = (i: number) => (data.length === 1 ? width / 2 : padX + (i / (data.length - 1)) * (width - padX * 2))
  const yFor = (v: number) => padTop + inner - ((v - min) / range) * inner
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(d.value)}`).join(" ")
  const selIdx = selected ?? data.length - 1
  const sel = data[selIdx]
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && data.length > 0 ? (
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map(f => (
            <Line key={f} x1={0} x2={width} y1={padTop + inner * f} y2={padTop + inner * f} stroke={colors.chartGrid} strokeWidth={1} />
          ))}
          <Path d={path} stroke={colors.chartPrimary} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => (
            <Circle key={i} cx={xFor(i)} cy={yFor(d.value)} r={i === selIdx ? 6 : 10} fill={i === selIdx ? colors.chartPrimary : "transparent"} stroke={i === selIdx ? colors.background : "transparent"} strokeWidth={2} onPress={() => setSelected(i)} />
          ))}
          {sel ? (
            <>
              <SvgText x={Math.min(width - 40, Math.max(40, xFor(selIdx)))} y={14} fontSize={typography.caption.fontSize} fontWeight="600" fill={colors.textPrimary} textAnchor="middle">
                {formatValue(sel.value)}
                {sel.caption ? ` · ${sel.caption}` : ""}
              </SvgText>
              <SvgText x={Math.min(width - 30, Math.max(30, xFor(selIdx)))} y={height - 6} fontSize={typography.caption.fontSize} fill={colors.textTertiary} textAnchor="middle">
                {sel.label}
              </SvgText>
            </>
          ) : null}
        </Svg>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text variant="footnote" color="tertiary">
            {emptyLabel}
          </Text>
        </View>
      )}
    </View>
  )
}
