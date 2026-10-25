import Svg, { Rect } from "react-native-svg"
import { useTheme } from "@/design-system"

/** Vector brand mark: three rising plates. Inherits the text colour so it works on any surface. */
export function BrandMark({ size = 48, accent = true }: { size?: number; accent?: boolean }) {
  const { colors } = useTheme()
  const s = size / 256
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Rect x={40} y={160} width={56} height={40} rx={12} fill={colors.textPrimary} opacity={0.6} />
      <Rect x={40} y={104} width={112} height={40} rx={12} fill={colors.textPrimary} opacity={0.85} />
      <Rect x={40} y={48} width={176} height={40} rx={12} fill={accent ? colors.accent : colors.textPrimary} />
      <Rect x={0} y={0} width={1} height={1} fill="transparent" opacity={s} />
    </Svg>
  )
}
