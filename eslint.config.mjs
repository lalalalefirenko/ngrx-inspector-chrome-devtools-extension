import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";
import prettierConfig from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import prettier from "eslint-plugin-prettier";
import rxjs from "eslint-plugin-rxjs-x";
import sonarjs from "eslint-plugin-sonarjs";
import security from "eslint-plugin-security";
import unicorn from "eslint-plugin-unicorn";
import boundaries from "eslint-plugin-boundaries";
import importPlugin from "eslint-plugin-import";
import stylistic from "@stylistic/eslint-plugin";
import preferArrow from "eslint-plugin-prefer-arrow";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      ".angular/**",
      "**/*.stories.ts",
    ],
  },

  // TypeScript files configuration
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    plugins: {
      "@stylistic": stylistic,
      "prefer-arrow": preferArrow,
      jsdoc,
      prettier,
      rxjs,
      sonarjs,
      boundaries,
      security,
      unicorn,
      import: importPlugin,
    },
    processor: angular.processInlineTemplates,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      jsdoc: {
        tagNamePreference: {
          returns: "return",
        },
      },
    },
    rules: {
      // Angular rules
      "@angular-eslint/component-class-suffix": [
        "warn",
        {
          suffixes: ["Component", "Svg"],
        },
      ],
      "@angular-eslint/component-selector": "off",
      "@angular-eslint/directive-class-suffix": "warn",
      "@angular-eslint/directive-selector": [
        "warn",
        {
          style: "camelCase",
          type: "attribute",
        },
      ],
      "@angular-eslint/no-empty-lifecycle-method": "warn",
      "@angular-eslint/no-host-metadata-property": "off",
      "@angular-eslint/no-input-rename": "off",
      "@angular-eslint/no-inputs-metadata-property": "warn",
      "@angular-eslint/no-output-native": "warn",
      "@angular-eslint/no-output-on-prefix": "warn",
      "@angular-eslint/no-output-rename": "warn",
      "@angular-eslint/no-outputs-metadata-property": "warn",
      "@angular-eslint/use-lifecycle-interface": "warn",
      "@angular-eslint/use-pipe-transform-interface": "off",
      "@angular-eslint/prefer-on-push-component-change-detection": "error",

      // TypeScript rules
      "@typescript-eslint/adjacent-overload-signatures": "off",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-wrapper-object-types": "warn",
      "@typescript-eslint/consistent-type-definitions": "warn",
      "@typescript-eslint/dot-notation": "off",
      "@typescript-eslint/explicit-member-accessibility": [
        "off",
        {
          accessibility: "explicit",
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      "@typescript-eslint/member-ordering": "off",
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          selector: "variable",
        },
      ],
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-misused-new": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-unused-expressions": [
        "warn",
        { allowTernary: true },
      ],
      "@typescript-eslint/prefer-function-type": "warn",
      "@typescript-eslint/typedef": [
        "warn",
        {
          arrayDestructuring: true,
          arrowParameter: true,
          memberVariableDeclaration: true,
          objectDestructuring: true,
          parameter: true,
          propertyDeclaration: true,
          variableDeclaration: true,
          variableDeclarationIgnoreFunction: true,
        },
      ],
      "@typescript-eslint/unified-signatures": "warn",

      // Stylistic rules
      "@stylistic/member-delimiter-style": [
        "warn",
        {
          multiline: {
            delimiter: "semi",
            requireLast: true,
          },
          singleline: {
            delimiter: "semi",
            requireLast: false,
          },
        },
      ],
      "@stylistic/quotes": ["warn", "double"],
      "@stylistic/semi": ["warn", "always"],
      "@stylistic/type-annotation-spacing": "warn",

      // Core ESLint rules
      "array-bracket-spacing": ["off", "always"],
      "array-element-newline": ["warn", "consistent"],
      "arrow-body-style": "warn",
      "brace-style": ["off", "stroustrup"],
      "capitalized-comments": [
        "warn",
        "always",
        {
          ignoreInlineComments: true,
          ignorePattern: "region|endregion|noinspection",
        },
      ],
      "comma-dangle": ["warn", "always-multiline"],
      "constructor-super": "warn",
      curly: "warn",
      "eol-last": "warn",
      eqeqeq: ["warn", "smart"],
      "guard-for-in": "warn",
      "id-blacklist": [
        "warn",
        "any",
        "Number",
        "String",
        "string",
        "Boolean",
        "boolean",
        "Undefined",
        "undefined",
      ],
      "id-match": "warn",
      "max-len": [
        "warn",
        {
          code: 120,
          ignorePattern: "^import|^export|src/",
        },
      ],
      "no-bitwise": "warn",
      "no-caller": "warn",
      "no-console": "warn",
      "no-debugger": "warn",
      "no-eval": "warn",
      "no-fallthrough": "warn",
      "no-multiple-empty-lines": "warn",
      "no-nested-ternary": "error",
      "no-new-wrappers": "warn",
      "no-restricted-syntax": ["warn", "ForInStatement"],
      "no-shadow": "off",
      "no-throw-literal": "warn",
      "no-trailing-spaces": "warn",
      "no-undef-init": "warn",
      "no-underscore-dangle": "off",
      "no-unneeded-ternary": "error",
      "no-unused-labels": "warn",
      "no-unused-vars": "off",
      "no-var": "warn",
      "object-curly-spacing": ["warn", "always"],
      "object-shorthand": "warn",
      "padding-line-between-statements": [
        "warn",
        {
          blankLine: "always",
          next: "return",
          prev: "*",
        },
      ],
      "prefer-const": "warn",
      radix: "warn",

      // JSDoc rules
      "jsdoc/no-types": "off",
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns": [
        "warn",
        {
          checkGetters: false,
        },
      ],
      "jsdoc/require-returns-type": "off",
      "jsdoc/tag-lines": "off",
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns-description": "off",

      // Prefer Arrow rules
      "prefer-arrow/prefer-arrow-functions": "off",

      // Unicorn rules
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-null": "off",
      "unicorn/prefer-ternary": "off",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-static-only-class": "off",
      "unicorn/no-array-callback-reference": "off",
      "unicorn/prefer-string-replace-all": "off",

      // RxJS rules (rxjs-x plugin)
      "rxjs/no-unbound-methods": "off",

      // Boundaries rules
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: "projects/common",
              allow: ["projects/common"],
              disallow: ["projects/ekd-ui", "projects/ekd-ui-login"],
            },
            {
              from: "projects/ekd-ui",
              allow: [
                "projects/common",
                "shared",
                "domains",
                "common-dialogs",
                "root-store",
                "root-services",
                "root-models",
                "root",
                "root-models",
                "root-services",
                "root-store",
                "pages",
                "root",
              ],
            },
            {
              from: "projects/ekd-ui-login",
              allow: ["projects/common"],
              disallow: ["projects/ekd-ui"],
            },
            {
              from: "legacy-shared",
              allow: ["legacy-shared"],
            },
            {
              from: "shared",
              allow: ["projects/common", "shared", "root-store"],
            },
            {
              from: "root",
              allow: [
                "projects/common",
                "shared",
                "domains",
                "root-store",
                "root-services",
                "root-models",
              ],
            },
            {
              from: "root-store",
              allow: [
                "projects/common",
                "shared",
                "domains",
                "common-dialogs",
                "root-store",
                "root-services",
                "root-models",
              ],
            },
            {
              from: "root-services",
              allow: [
                "projects/common",
                "shared",
                "domains",
                "root-services",
                "root-models",
              ],
            },
            {
              from: "domains",
              allow: [
                "projects/common",
                "shared",
                "domains",
                "root-store",
                "root-services",
                "root-models",
              ],
            },
            {
              from: "common-dialogs",
              allow: [
                "projects/common",
                "shared",
                "domains",
                "root-store",
                "root-services",
                "root-models",
              ],
            },
            {
              from: "pages",
              allow: [
                "projects/common",
                "shared",
                "domains",
                "common-dialogs",
                "root-store",
                "root-services",
                "root-models",
              ],
            },
          ],
        },
      ],

      // Import rules
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          pathGroups: [
            {
              pattern: "{@angular/**,rxjs{,/**}},@ngrx/**, @ngx-translate/**",
              group: "external",
            },
            { pattern: "@common-*/**", group: "internal", position: "before" },
            { pattern: "@ekd-ui-*/**", group: "internal", position: "after" },
            {
              pattern: "@ekd-login-*/**",
              group: "internal",
              position: "after",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "never",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      // Security rules
      "security/detect-object-injection": "off",

      // Sonarjs rules - disable deprecated/removed rules
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-duplicate-string": "off",
    },
  },

  // Prettier config for TypeScript (disables conflicting rules)
  {
    files: ["**/*.ts"],
    ...prettierConfig,
  },

  // HTML template files configuration
  {
    files: ["**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      "@angular-eslint/template/no-negated-async": "error",
      "@angular-eslint/template/attributes-order": "error",
      "@angular-eslint/template/button-has-type": "error",
      "@angular-eslint/template/conditional-complexity": [
        "error",
        {
          maxComplexity: 4,
        },
      ],
      "@angular-eslint/template/cyclomatic-complexity": [
        "error",
        {
          maxComplexity: 6,
        },
      ],
      "@angular-eslint/template/no-duplicate-attributes": "error",
      "@angular-eslint/template/prefer-control-flow": "error",
      "@angular-eslint/template/alt-text": "error",
    },
  },
);
