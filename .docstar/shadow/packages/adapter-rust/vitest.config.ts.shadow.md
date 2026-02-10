# packages/adapter-rust/vitest.config.ts
@source-hash: fe397d6a657d0a8a
@generated: 2026-02-10T00:41:42Z

**Purpose**: Vitest configuration for the adapter-rust package, defining test environment settings, file patterns, and module resolution.

**Key Configuration Sections**:
- **Test Settings (L5-16)**: Configures Vitest with global test utilities enabled, Node.js environment, and file inclusion patterns for `tests/` and `src/` directories with `.test` or `.spec` extensions
- **Module Aliases (L10-15, L19-21)**: Defines path resolution for `.js` extension stripping (L12) and workspace dependency `@debugmcp/shared` pointing to `../shared/src/index.ts` (L14, L20)
- **Resolution Configuration (L17-22)**: Sets supported file extensions (`.ts`, `.js`, `.json`, `.node`) and duplicates alias configuration

**Dependencies**:
- `vitest/config` for configuration utilities
- `path` for cross-platform path resolution
- Workspace dependency on `@debugmcp/shared` package

**Architecture Notes**:
- Follows monorepo structure with workspace-relative imports
- Handles TypeScript-to-JavaScript compilation artifacts by stripping `.js` extensions from relative imports
- Duplicated alias configuration between test and resolve sections ensures consistency across different resolution contexts
- Excludes standard build artifacts (`node_modules`, `dist`) from test discovery