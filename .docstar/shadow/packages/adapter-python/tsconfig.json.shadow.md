# packages\adapter-python\tsconfig.json
@source-hash: fb53f5891067a691
@generated: 2026-02-24T01:54:03Z

TypeScript configuration for the adapter-python package within a monorepo structure. This config extends the root TypeScript configuration and sets up compilation settings for building Python adapter functionality.

**Key Configuration Sections:**

- **Inheritance**: Extends root `../../tsconfig.json` (L2) for shared compiler defaults
- **Compilation Output**: Configured for composite builds with `outDir: "dist"` and `rootDir: "src"` (L5-7), enabling incremental compilation via `tsBuildInfoFile` (L5)
- **Module Resolution**: Sets up path mapping (L9-12) to resolve `@debugmcp/shared` imports to `../shared/dist`, indicating dependency on shared package
- **Project References**: References shared package (L18-20) for proper dependency ordering in monorepo builds
- **Source Inclusion**: Includes all files in `src/**/*` (L21) while excluding build artifacts, dependencies, and test files (L22)

**Build Configuration:**
- Enables declaration file generation with source maps (L13-14) for type exports
- Configures ES module interop (L15-16) for compatibility with CommonJS modules

**Architectural Dependencies:**
- Depends on `@debugmcp/shared` package for shared utilities/types
- Part of larger debugmcp monorepo structure
- Builds as composite project for incremental compilation optimization