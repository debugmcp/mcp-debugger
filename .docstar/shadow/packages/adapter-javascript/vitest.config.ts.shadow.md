# packages/adapter-javascript/vitest.config.ts
@source-hash: 6dc87debc6acf273
@generated: 2026-02-09T18:14:57Z

**Primary Purpose:** Vitest configuration file for the JavaScript adapter package, defining test execution environment, coverage settings, and module resolution rules.

**Key Configuration Sections:**

**Test Configuration (L5-18):**
- Globals enabled for test utilities (L6)
- Node environment for server-side testing (L7)
- Test file patterns: `tests/**/*.{test,spec}.ts` and `src/**/*.{test,spec}.ts` (L8)
- Excludes standard directories: `node_modules`, `dist` (L9)

**Coverage Configuration (L10-18):**
- V8 provider with text/lcov reporters (L11-12)
- Reports directory: `coverage` (L13)
- Clean disabled to preserve coverage data (L14-15)
- Extensive exclusions: tests, vendor, dist, scripts, config files, types, and specific adapter files (L16)
- High coverage thresholds: 90% for all metrics (L17)

**Module Resolution (L19-31):**
- Test alias configuration (L19-24): Strips `.js` extensions from relative imports and maps `@debugmcp/shared` to workspace shared package
- Global resolve aliases (L26-31): Handles TypeScript/JavaScript file extensions and workspace dependency mapping

**Dependencies:**
- `vitest/config` for configuration utilities
- `path` for workspace relative path resolution
- Workspace dependency: `@debugmcp/shared` package

**Architectural Decisions:**
- Monorepo workspace setup with shared package integration
- JavaScript extension handling for TypeScript source files
- Comprehensive coverage exclusions suggest focus on core adapter logic testing
- High coverage thresholds indicate quality-focused development approach