# packages\adapter-rust\tsconfig.json
@source-hash: fb53f5891067a691
@generated: 2026-02-24T01:54:04Z

TypeScript configuration for the `adapter-rust` package within a monorepo workspace.

**Primary Purpose**: Configures TypeScript compilation for a Rust adapter package, extending a root configuration with package-specific settings and shared dependency references.

**Key Configuration Elements**:
- **Base Configuration**: Extends root `tsconfig.json` (L2) for consistent workspace-wide TypeScript settings
- **Project References**: References `../shared` package (L18-20) establishing build dependency chain
- **Path Mapping**: Maps `@debugmcp/shared` imports to compiled output in `../shared/dist` (L10-12)
- **Build Configuration**: 
  - Enables composite project mode (L4) for incremental builds in project references
  - Sets build info file location (L5) and output directory to `dist` (L6)
  - Configures source root as `src` directory (L7)
- **Type Generation**: Enables declaration file generation with source maps (L13-14)
- **Module Compatibility**: Configures ES module interop and synthetic default imports (L15-16)

**Build Strategy**: 
- Includes all TypeScript files in `src/**/*` (L21)
- Excludes build artifacts, dependencies, and test files (L22)
- Part of incremental build system using TypeScript project references

This configuration supports a modular architecture where the adapter-rust package depends on shared utilities while maintaining separate build outputs and enabling efficient incremental compilation.