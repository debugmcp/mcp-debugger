# packages/adapter-python/vitest.config.ts
@source-hash: fe397d6a657d0a8a
@generated: 2026-02-10T00:41:40Z

## Primary Purpose
Vitest test configuration file for the adapter-python package, configuring test environment, file patterns, and module resolution.

## Key Configuration Sections

**Test Configuration (L5-16)**
- Enables global test APIs (`globals: true`)
- Sets Node.js environment for tests
- Includes test files from `tests/` and `src/` directories with `.test.ts` or `.spec.ts` extensions
- Excludes `node_modules` and `dist` directories from test discovery

**Module Resolution Aliases (L10-15, L19-21)**
- JavaScript extension stripping: Maps `.js` imports to TypeScript files without extension (L12)
- Workspace alias: `@debugmcp/shared` resolves to `../shared/src/index.ts` for local development

**Resolver Configuration (L17-22)**
- Supports TypeScript, JavaScript, JSON, and Node.js binary files
- Duplicates workspace alias configuration for consistent module resolution

## Dependencies
- `vitest/config` for test framework configuration
- Node.js `path` module for cross-platform path resolution

## Architectural Notes
- Follows monorepo pattern with workspace-relative imports
- Handles TypeScript-to-JavaScript import mapping for compatibility
- Centralizes shared package access through alias configuration