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

  // Apply TypeScript recommended rules globally for .ts files
  // This typically includes the parser, plugin, and recommended rules.
  ...tseslint.configs.recommended,

  // Configuration for JavaScript files (if any, e.g., config files themselves)
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...js.configs.recommended, // Apply ESLint's recommended JS rules
    languageOptions: {
      globals: {
        ...globals.node, // Node globals for JS files
      },
      ecmaVersion: "latest",
      sourceType: "module", // Assuming JS config files might also be modules
    },
  },

  // Specifics for TypeScript source files (src directory)
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node, // Or globals.nodeBuiltin
      },
      parserOptions: {
        project: ["./tsconfig.json"], // Path to your tsconfig.json
        // tsconfigRootDir: import.meta.dirname, // If tsconfig.json is not in the same dir as eslint.config.js
      },
    },
    // Add any src-specific rules or overrides here
    // Example:
    // rules: {
    //   "@typescript-eslint/no-unused-vars": "warn",
    // }
  },

  // More lenient rules for test files
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node, // Tests also run in Node
      },
      parserOptions: {
        project: ["./tsconfig.spec.json"], // Use tsconfig.spec.json for test files
        // tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn", // Allow but warn
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      // Catch unhandled promises - exactly the issue we just fixed!
      "@typescript-eslint/no-floating-promises": "error"
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
  
  // Note: Ignores for build, node_modules, etc. are also typically handled by .eslintignore
  // or by not including them in the `files` patterns of lintable configurations.
  // Adding them here ensures ESLint's flat config explicitly skips them if it tries to glob them.
];
