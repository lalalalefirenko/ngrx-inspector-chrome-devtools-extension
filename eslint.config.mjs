import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", ".angular/**", "coverage/**", "out-tsc/**"],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/prefer-on-push-component-change-detection": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/**/*.html"],
    extends: [...angular.configs.templateRecommended],
  },
  {
    files: ["*.js", "*.mjs", "tests/**/*.cjs"],
    extends: [eslint.configs.recommended],
    languageOptions: {
      globals: {
        chrome: "readonly",
        window: "readonly",
      },
    },
  },
  {
    files: ["tests/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        __dirname: "readonly",
        require: "readonly",
        setImmediate: "readonly",
      },
    },
  },
);
