import { useEffect, useRef, useState } from "react"
import { Animated, Easing, Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { SymbolView } from "expo-symbols"
import { EXERCISE_MEDIA } from "@/assets/exercise-media"
import { useTheme } from "@/design-system"

/** Source photos are 3:2. */
const ASPECT = 3 / 2

export function hasExerciseMedia(slug: string | null | undefined): boolean {
  return !!slug && slug in EXERCISE_MEDIA
}

/**
 * Two-frame animation (start → end position) of a system exercise. Crossfades
 * between the frames so the movement is readable at a glance. Falls back to a
 * neutral placeholder for custom exercises without media.
 */
export function ExerciseAnimation({ slug, style, playing = true, intervalMs = 1100, showIndicator = true }: { slug: string | null | undefined; style?: StyleProp<ViewStyle>; playing?: boolean; intervalMs?: number; showIndicator?: boolean }) {
  const { colors, radius } = useTheme()
  const frames = slug ? EXERCISE_MEDIA[slug] : undefined
  const progress = useRef(new Animated.Value(0)).current
  const [frame, setFrame] = useState<0 | 1>(0)

  useEffect(() => {
    if (!frames || !playing) return
    const id = setInterval(() => setFrame(f => (f === 0 ? 1 : 0)), intervalMs)
    return () => clearInterval(id)
  }, [frames, playing, intervalMs])

  useEffect(() => {
    Animated.timing(progress, { toValue: frame, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start()
  }, [frame, progress])

  if (!frames) return <MediaPlaceholder style={style} />
  return (
    <View style={[{ aspectRatio: ASPECT, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceMuted }, style]} accessibilityLabel="Bewegungsablauf der Übung">
      <Image source={frames[0]} style={styles.fill} resizeMode="cover" />
      <Animated.Image source={frames[1]} style={[styles.fill, { opacity: progress }]} resizeMode="cover" />
      {showIndicator ? (
        <View style={[styles.dots, { backgroundColor: colors.glassTint }]}>
          <View style={[styles.dot, { backgroundColor: frame === 0 ? colors.textPrimary : colors.textTertiary }]} />
          <View style={[styles.dot, { backgroundColor: frame === 1 ? colors.textPrimary : colors.textTertiary }]} />
        </View>
      ) : null}
    </View>
  )
}

/** Static first frame, for list rows. */
export function ExerciseThumbnail({ slug, size = 56, style }: { slug: string | null | undefined; size?: number; style?: StyleProp<ViewStyle> }) {
  const { colors, radius } = useTheme()
  const frames = slug ? EXERCISE_MEDIA[slug] : undefined
  const box = { width: size, height: Math.round(size / ASPECT), borderRadius: radius.sm, overflow: "hidden" as const, backgroundColor: colors.surfaceMuted }
  if (!frames) {
    return (
      <View style={[box, styles.center, style]}>
        <SymbolView name="figure.strengthtraining.traditional" size={Math.round(size * 0.36)} tintColor={colors.textTertiary} />
      </View>
    )
  }
  return (
    <View style={[box, style]}>
      <Image source={frames[0]} style={{ width: size, height: box.height }} resizeMode="cover" />
    </View>
  )
}

function MediaPlaceholder({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors, radius } = useTheme()
  return (
    <View style={[{ aspectRatio: ASPECT, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted }, styles.center, style]}>
      <SymbolView name="figure.strengthtraining.traditional" size={44} tintColor={colors.textTertiary} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  fill: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  dots: { position: "absolute", bottom: 8, right: 8, flexDirection: "row", gap: 5, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
