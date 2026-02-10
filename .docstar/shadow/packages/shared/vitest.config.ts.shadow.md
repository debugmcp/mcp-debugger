# packages/shared/vitest.config.ts
@source-hash: a85c5636cfedc300
@generated: 2026-02-09T18:14:55Z

## Purpose
Configuration file for Vitest test runner in the shared package. Defines test environment settings, coverage reporting, and module resolution for TypeScript testing.

## Key Configuration (L4-26)
- **Test Environment**: Node.js environment with global test functions enabled (L6-7)
- **Coverage Setup**: Istanbul provider with multi-format reporting - text, JSON, and HTML outputs (L8-18)
- **Module Resolution**: TypeScript/JavaScript support with `@` alias pointing to `./src` directory (L20-25)

## Dependencies
- `vitest/config`: Core Vitest configuration utilities (L1)
- `path`: Node.js path module for directory resolution (L2)

## Coverage Exclusions (L11-17)
Excludes common non-testable files: node_modules, dist directory, TypeScript declarations, and test files themselves from coverage reports.

## Architectural Notes
- Uses ES module syntax with default export
- Provides standard TypeScript project setup with source aliasing
- Configured for monorepo shared package testing with comprehensive coverage reporting