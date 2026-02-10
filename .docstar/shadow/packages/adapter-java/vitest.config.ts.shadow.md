# packages/adapter-java/vitest.config.ts
@source-hash: 61b5f337e11d6a58
@generated: 2026-02-09T18:14:54Z

## Purpose
Configuration file for Vitest test framework in a Java adapter package. Sets up testing environment, coverage reporting, and test file discovery patterns.

## Key Configuration
- **Test Environment** (L6): Configured for Node.js runtime environment
- **Global Test APIs** (L5): Enables global test functions (describe, it, expect) without imports
- **Test File Patterns** (L7): Discovers test files matching `tests/**/*.test.ts` and `tests/**/*.spec.ts`
- **Coverage Configuration** (L8-12): Uses V8 provider with text, JSON, and HTML reporting; excludes distribution files, dependencies, and test files from coverage analysis

## Dependencies
- `vitest/config` (L1): Core Vitest configuration utilities

## Architecture Notes
- Standard Vitest configuration using `defineConfig` pattern for type safety
- Excludes common non-source directories from coverage to focus on actual implementation code
- Supports both `.test.ts` and `.spec.ts` naming conventions for flexibility