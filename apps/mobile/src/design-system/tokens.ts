/**
 * Pondus design tokens. Every component reads from here; screens never hardcode
 * colors, spacing or radii. Light and dark palettes share the same semantic keys.
 */
export const palette = {
  // Brand
  ember500: "#FF7A1A",
  ember400: "#FF9A3D",
  ember600: "#E3640A",
  emberSoftLight: "#FFE9D6",
  emberSoftDark: "#3A2314",
  // Neutrals (warm graphite)
  ink950: "#0B0C0E",
  ink900: "#111317",
  ink850: "#17191D",
  ink800: "#1E2126",
  ink700: "#2A2E35",
  ink600: "#3A3F48",
  ink500: "#5C626D",
  ink400: "#8A909B",
  ink300: "#B6BAC2",
  ink200: "#D9DBDF",
  ink100: "#ECEBE8",
  ink50: "#F4F2EE",
  white: "#FFFFFF",
  // Status
  green500: "#2FBF71",
  green600: "#1F9A58",
  amber500: "#F2B705",
  red500: "#E5484D",
  red600: "#C93A3F",
  blue500: "#3C82F6",
} as const

export interface ColorScheme {
  background: string
  backgroundElevated: string
  surface: string
  surfaceMuted: string
  surfaceStrong: string
  border: string
  borderStrong: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  textInverse: string
  textOnAccent: string
  accent: string
  accentPressed: string
  accentSoft: string
  accentText: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  info: string
  overlay: string
  tabBarTint: string
  glassTint: string
  chartPrimary: string
  chartSecondary: string
  chartMuted: string
  chartGrid: string
}

export const lightColors: ColorScheme = {
  background: palette.ink50,
  backgroundElevated: palette.white,
  surface: palette.white,
  surfaceMuted: palette.ink100,
  surfaceStrong: palette.ink900,
  border: "rgba(17, 19, 23, 0.08)",
  borderStrong: "rgba(17, 19, 23, 0.16)",
  textPrimary: palette.ink900,
  textSecondary: palette.ink500,
  textTertiary: palette.ink400,
  textInverse: palette.ink50,
  textOnAccent: palette.white,
  accent: palette.ember500,
  accentPressed: palette.ember600,
  accentSoft: palette.emberSoftLight,
  accentText: palette.ember600,
  success: palette.green600,
  successSoft: "rgba(47, 191, 113, 0.14)",
  warning: palette.amber500,
  warningSoft: "rgba(242, 183, 5, 0.16)",
  danger: palette.red600,
  dangerSoft: "rgba(229, 72, 77, 0.12)",
  info: palette.blue500,
  overlay: "rgba(11, 12, 14, 0.45)",
  tabBarTint: palette.ink900,
  glassTint: "rgba(255, 255, 255, 0.55)",
  chartPrimary: palette.ember500,
  chartSecondary: palette.ink900,
  chartMuted: palette.ink200,
  chartGrid: "rgba(17, 19, 23, 0.08)",
}

export const darkColors: ColorScheme = {
  background: palette.ink950,
  backgroundElevated: palette.ink900,
  surface: palette.ink850,
  surfaceMuted: palette.ink800,
  surfaceStrong: palette.ink50,
  border: "rgba(244, 242, 238, 0.08)",
  borderStrong: "rgba(244, 242, 238, 0.16)",
  textPrimary: palette.ink50,
  textSecondary: palette.ink300,
  textTertiary: palette.ink400,
  textInverse: palette.ink900,
  textOnAccent: palette.ink950,
  accent: palette.ember500,
  accentPressed: palette.ember400,
  accentSoft: palette.emberSoftDark,
  accentText: palette.ember400,
  success: palette.green500,
  successSoft: "rgba(47, 191, 113, 0.18)",
  warning: palette.amber500,
  warningSoft: "rgba(242, 183, 5, 0.18)",
  danger: palette.red500,
  dangerSoft: "rgba(229, 72, 77, 0.18)",
  info: palette.blue500,
  overlay: "rgba(0, 0, 0, 0.6)",
  tabBarTint: palette.ink50,
  glassTint: "rgba(23, 25, 29, 0.55)",
  chartPrimary: palette.ember400,
  chartSecondary: palette.ink50,
  chartMuted: palette.ink700,
  chartGrid: "rgba(244, 242, 238, 0.08)",
}

/** 4pt grid. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64 } as const
export type SpaceKey = keyof typeof space

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const

export const typography = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: "800" as const, letterSpacing: -1.2 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.6 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const, letterSpacing: -0.4 },
  title3: { fontSize: 18, lineHeight: 24, fontWeight: "600" as const, letterSpacing: -0.2 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400" as const, letterSpacing: -0.2 },
  bodyStrong: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const, letterSpacing: -0.2 },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: "400" as const, letterSpacing: -0.1 },
  calloutStrong: { fontSize: 15, lineHeight: 20, fontWeight: "600" as const, letterSpacing: -0.1 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const, letterSpacing: 0.2 },
  /** Tabular numerals for weights/reps/timers. */
  numeral: { fontSize: 24, lineHeight: 28, fontWeight: "700" as const, letterSpacing: -0.4, fontVariant: ["tabular-nums"] as const },
  numeralLarge: { fontSize: 56, lineHeight: 60, fontWeight: "800" as const, letterSpacing: -2, fontVariant: ["tabular-nums"] as const },
} as const
export type TypographyKey = keyof typeof typography

export const shadows = {
  none: {},
  sm: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  md: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  lg: { shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 28, shadowOffset: { width: 0, height: 12 } },
} as const

export const motion = {
  fast: 160,
  base: 240,
  slow: 360,
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  springSnappy: { damping: 22, stiffness: 320, mass: 0.8 },
} as const

export const sizes = {
  touchTarget: 44,
  buttonHeight: 52,
  buttonHeightSmall: 40,
  inputHeight: 52,
  iconSm: 18,
  iconMd: 22,
  iconLg: 28,
  tabBarHeight: 50,
  floatingBarHeight: 72,
} as const
