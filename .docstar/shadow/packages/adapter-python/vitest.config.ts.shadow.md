# packages/adapter-python/vitest.config.ts
@source-hash: fe397d6a657d0a8a
@generated: 2026-02-09T18:14:58Z

## Primary Purpose
Vitest test configuration for the Python adapter package, establishing test environment, file resolution, and module aliasing for the test runner.

## Configuration Structure
- **Main Config Export (L4-23)**: Default Vitest configuration object with test and resolve sections
- **Test Configuration (L5-16)**: Defines test environment, file patterns, and test-specific aliases
- **Resolution Configuration (L17-22)**: Handles module resolution and import aliasing

## Key Configuration Sections

### Test Environment Setup (L5-9)
- Enables global test APIs (L6)
- Uses Node.js environment (L7) 
- Includes test files from `tests/` and `src/` directories with `.test` or `.spec` extensions (L8)
- Excludes `node_modules` and `dist` directories (L9)

### Import Alias Handling (L10-15, L19-21)
- **JS Extension Stripping (L12)**: Regex pattern removes `.js` extensions from relative imports to support TypeScript
- **Workspace Alias (L14, L20)**: Maps `@debugmcp/shared` to the shared package source for local development

### Module Resolution (L17-22)
- Supports multiple file extensions: `.ts`, `.js`, `.json`, `.node` (L18)
- Duplicates workspace alias configuration for consistent resolution

## Dependencies
- `vitest/config`: Test framework configuration
- `path`: Node.js path utilities for workspace alias resolution

## Architecture Notes
- Follows Vitest best practices for TypeScript project testing
- Enables monorepo development with workspace package aliasing
- Handles mixed JS/TS import compatibility through extension stripping