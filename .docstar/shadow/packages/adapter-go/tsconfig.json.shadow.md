# packages\adapter-go\tsconfig.json
@source-hash: 59c8fc18898bf301
@generated: 2026-02-24T01:54:02Z

TypeScript configuration for the adapter-go package, specifying modern Node.js compilation settings and project references.

## Configuration Settings

**Compilation Target**: ES2022 with NodeNext module system (L6-8) for modern Node.js compatibility
**Output Configuration**: Builds from `src/` to `dist/` with full type declaration generation (L4-5, L9-10)
**Source Maps**: Enabled for both JavaScript and declaration files (L10-11) for debugging support
**Project Composite**: Configured as TypeScript project reference target (L12)

## File Inclusion/Exclusion

**Included Sources**: All files under `src/**/*` (L14)
**Excluded Paths**: Standard exclusions for node_modules, dist, and test files (L15)

## Dependencies

**Base Configuration**: Extends root `../../tsconfig.json` (L2) for shared settings
**Project Reference**: Links to `../shared` package (L17) enabling cross-package type checking and incremental builds

This configuration enables the adapter-go package to participate in TypeScript's project references system while targeting modern Node.js environments with full type declaration support.