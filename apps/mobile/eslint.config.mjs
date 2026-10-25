import js from "@eslint/js"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"
export default tseslint.config(
  { ignores: ["ios/**", ".expo/**", "node_modules/**", "*.config.js", "babel.config.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Non-breaking spaces in UI copy keep "z. B." or "2,5 kg" on one line.
      "no-irregular-whitespace": ["error", { skipJSXText: true }],
    },
  },
)
