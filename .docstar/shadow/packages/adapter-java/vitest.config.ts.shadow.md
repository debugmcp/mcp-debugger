# packages/adapter-java/vitest.config.ts
@source-hash: 61b5f337e11d6a58
@generated: 2026-02-10T00:41:42Z

## Purpose
Configuration file for Vitest test runner in the Java adapter package. Defines test execution environment, file matching patterns, and code coverage settings.

## Configuration Structure
- **Main export** (L3-14): Default Vitest configuration object using `defineConfig` helper
- **Test settings** (L4-13): Core test execution parameters
  - **Global APIs** (L5): Enables global test functions (describe, it, expect) without imports
  - **Environment** (L6): Node.js runtime environment for test execution
  - **File patterns** (L7): Includes TypeScript test files from `tests/` directory with `.test.ts` and `.spec.ts` extensions
  - **Coverage configuration** (L8-12): V8-based code coverage with multiple output formats

## Dependencies
- `vitest/config`: Provides the `defineConfig` helper function for type-safe configuration

## Key Features
- **Multi-format coverage**: Text, JSON, and HTML reports (L10)
- **Smart exclusions**: Excludes build artifacts (`dist/`), dependencies (`node_modules/`), and test files themselves from coverage (L11)
- **TypeScript support**: Configured to handle `.ts` test files

## Architectural Notes
- Standard Vitest configuration pattern for TypeScript projects
- Coverage exclusion strategy prevents inflated metrics from non-source files
- Node environment suggests this adapter deals with server-side Java integration rather than browser-based testing