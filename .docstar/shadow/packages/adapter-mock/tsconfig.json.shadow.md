# packages\adapter-mock\tsconfig.json
@source-hash: d7326633d32ebab9
@generated: 2026-02-24T01:54:03Z

## TypeScript Configuration for Mock Adapter Package

This TSConfig configures compilation for the `adapter-mock` package within a monorepo structure with project references.

### Key Configuration Elements

**Base Configuration (L2)**: Extends root `../../tsconfig.json` for shared settings across the monorepo

**Compilation Settings (L4-8)**:
- `composite: true` - Enables TypeScript project references for incremental builds
- Build artifacts output to `dist/` directory with build info tracking
- Source code located in `src/` directory

**Module Resolution (L9-12)**: Path mapping for `@debugmcp/shared` package pointing to compiled output in `../shared/dist`

**Declaration Generation (L13-14)**: Produces `.d.ts` declaration files and source maps for TypeScript consumers

**Project Dependencies (L16-18)**: References the `shared` package as a dependency, enabling incremental compilation

**File Inclusion/Exclusion (L19-21)**: 
- Includes all files under `src/`
- Excludes build artifacts, dependencies, and test files from compilation

### Architecture Notes

This configuration follows TypeScript project references pattern for monorepo builds, allowing the mock adapter to depend on shared utilities while maintaining build isolation and enabling incremental compilation.