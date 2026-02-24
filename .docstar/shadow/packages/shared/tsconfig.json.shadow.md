# packages\shared\tsconfig.json
@source-hash: e5eb58b58ee8c1a2
@generated: 2026-02-24T01:54:05Z

TypeScript configuration for the shared package within a monorepo setup. Defines compilation settings optimized for modern Node.js ESM development with strict typing and build artifact generation.

## Compiler Configuration
- **Target & Module**: ES2022 with NodeNext module system (L3-5) for modern JavaScript features and Node.js ESM compatibility
- **Source Structure**: Source files in `src/` directory (L16, L30), compiled output to `dist/` (L11)
- **Declaration Generation**: Produces TypeScript declaration files (.d.ts) with source maps for library consumption (L12-13)
- **Build Optimization**: Composite project setup (L19) with build info caching (L20) for incremental compilation in monorepos

## Module Resolution
- **NodeNext Resolution**: Full ESM compatibility with Node.js module resolution (L5)
- **JSON Imports**: Enables importing JSON files as modules (L17)
- **Path Mapping**: Fallback to node_modules for unresolved imports (L22-24)

## Development Features
- **Strict Type Checking**: All strict TypeScript checks enabled (L9)
- **ts-node Integration**: ESM support for direct TypeScript execution (L26-28) with experimental Node.js specifier resolution
- **Source Maps**: Full debugging support with generated source maps (L15)

## Build Scope
- **Included**: All files under `src/` directory (L30)
- **Excluded**: Dependencies, build artifacts, and test files (L31) to prevent compilation conflicts

This configuration enables the shared package to be consumed as both a development dependency and a compiled library within the monorepo ecosystem.