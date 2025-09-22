import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // Global ignores - exclude build artifacts and non-essential files
  {
    ignores: [
      "**/*.d.ts", // Ignore all TypeScript declaration files
      "build/",
      "node_modules/",
      "coverage/",
      "*.log",
      "sessions/",
      
      // Exclude build artifacts and manual test files
      "tests/manual/build/**",
      "tests/jest-register.js",
      "test-*.js", "test-*.cjs",
      
      // Exclude helper scripts (non-production code)
      "tests/test-utils/helpers/*.cjs",
      "tests/test-utils/helpers/*.js",
      "tests/manual/*.cjs", "tests/manual/*.js", "tests/manual/*.mjs",
      "tests/mcp_debug_test.js"
    ]
  },

  // TypeScript flat recommended config (scoped by typescript-eslint to TS files)
  ...tseslint.configs.recommended,

  // JavaScript rules (only JS files)
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },

  // TS project-aware settings for repo TS sources and tests
  {
    files: ["src/**/*.ts", "packages/*/src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      
    },
  },

  // More lenient rules for test files
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/ban-ts-comment": "warn"
    }
  },
  
  // Very lenient for mock files (they need flexibility)
  {
    files: ["tests/test-utils/mocks/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/ban-ts-comment": "off"
    }
  },
  
  // Script utilities (Node CJS/JS): relax some rules to avoid noise in maintenance scripts
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    rules: {
      "no-unused-vars": "off",
      "no-useless-escape": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off"
    }
  },
];
