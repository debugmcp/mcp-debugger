# tsconfig.src.json
@source-hash: 3a6841883e1ec1cf
@generated: 2026-02-24T01:54:04Z

## Purpose
TypeScript configuration file specifically for compiling source code in production builds, extending the base configuration with output and compilation settings.

## Key Configuration
- **Base Extension (L2)**: Inherits from `./tsconfig.json` for shared compiler options
- **Composite Mode (L4)**: Enables TypeScript project references for incremental builds
- **Directory Structure (L5-6)**: Maps `src/` input to `dist/` output directory
- **Declaration Generation (L7)**: Produces `.d.ts` type declaration files for library consumers
- **Source Maps (L8)**: Generates source map files for debugging compiled output
- **Module System (L9-10)**: Uses NodeNext module/resolution for modern Node.js compatibility
- **Target Runtime (L11)**: Compiles to ES2022 JavaScript features
- **JavaScript Exclusion (L12)**: Strict TypeScript-only compilation

## File Scope
- **Includes (L14)**: All files under `src/**/*` directory tree
- **Excludes (L15)**: Test files, build artifacts (`tests`, `dist`, `build`)

## Architectural Role
This is a specialized build configuration that creates a production-ready compilation context separate from development/testing configurations. The composite flag suggests this project participates in a larger TypeScript project reference graph.