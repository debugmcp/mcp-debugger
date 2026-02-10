# packages/adapter-mock/vitest.config.ts
@source-hash: fe397d6a657d0a8a
@generated: 2026-02-10T00:41:42Z

**Primary Purpose**: Vitest configuration for the adapter-mock package, defining test environment settings, file inclusion patterns, and module resolution aliases.

**Key Configuration Sections**:
- **Test Configuration (L5-16)**: Sets up Node.js testing environment with global test functions enabled
- **File Patterns (L8-9)**: Includes test files from `tests/**/*.{test,spec}.ts` and `src/**/*.{test,spec}.ts`, excludes `node_modules` and `dist`
- **Test Aliases (L10-15)**: 
  - JS extension stripping regex (L12): `^(\\.{1,2}/.+)\\.js$` → `$1` for handling .js imports in TypeScript
  - Workspace alias (L14): `@debugmcp/shared` → `../shared/src/index.ts`
- **Resolve Configuration (L17-22)**: Module resolution with TypeScript-first extension priority and duplicate workspace alias

**Dependencies**: 
- `vitest/config` for configuration utilities
- `path` for cross-platform path resolution

**Architecture Notes**:
- Monorepo setup evidenced by workspace alias to `../shared` package
- TypeScript-centric with JS extension handling for compatibility
- Standard Node.js test environment suitable for adapter testing

**Key Patterns**:
- Duplicate alias definitions (test.alias and resolve.alias) ensure consistency across test and build contexts
- Extension stripping regex accommodates TypeScript compilation artifacts