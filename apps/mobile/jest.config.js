/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  // pnpm nests packages under node_modules/.pnpm/<pkg>/node_modules/<name>; skip the .pnpm segment and
  // transform React Native / Expo packages (they ship untranspiled ESM) plus our workspace package.
  transformIgnorePatterns: [
    "node_modules/(?!\\.pnpm/)(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@pondus/.*))",
  ],
  setupFiles: ["<rootDir>/src/test-setup.ts"],
}
