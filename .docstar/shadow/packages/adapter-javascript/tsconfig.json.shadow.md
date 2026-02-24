# packages\adapter-javascript\tsconfig.json
@source-hash: fb53f5891067a691
@generated: 2026-02-24T01:54:04Z

TypeScript configuration file for the JavaScript adapter package in a multi-package workspace.

**Primary Purpose**: Configures TypeScript compilation for the JavaScript adapter with project references and path mapping to shared dependencies.

**Key Configuration Elements**:
- Extends root workspace TypeScript config (L2)
- Enables composite builds with build info caching (L4-5) for incremental compilation
- Maps output to `dist/` directory with sources from `src/` (L6-7)
- Path mapping for `@debugmcp/shared` package dependency (L9-12)
- Project reference to shared package (L18-20) for workspace dependency management
- Declaration file generation enabled (L13-14) for TypeScript consumers
- ES module interop settings (L15-16) for CommonJS/ESM compatibility

**Build Behavior**:
- Includes all TypeScript files from `src/` directory (L21)
- Excludes build outputs, dependencies, and test files (L22)
- Supports incremental builds through composite project structure
- Generates `.d.ts` declaration files and source maps

**Workspace Integration**: Part of a monorepo structure with dependency on `../shared` package, configured for TypeScript project references build system.