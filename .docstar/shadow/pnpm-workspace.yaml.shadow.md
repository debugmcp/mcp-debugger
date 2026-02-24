# pnpm-workspace.yaml
@source-hash: 477e6c5f8b033a1e
@generated: 2026-02-24T01:54:01Z

## Purpose
PNPM workspace configuration file that defines package discovery patterns for monorepo management.

## Configuration Structure
- **packages** (L1-2): Array of glob patterns specifying workspace package locations
  - `'packages/*'` pattern includes all subdirectories under the packages/ folder as workspace members

## Key Characteristics
- Minimal workspace setup with single package directory pattern
- Enables PNPM to treat each subdirectory in `packages/` as a separate npm package
- Supports shared dependency management and cross-package linking within the monorepo
- YAML format follows PNPM workspace specification

## Usage Context
This configuration allows PNPM to:
- Install dependencies across all workspace packages with a single command
- Create symlinks between packages for local development
- Hoist shared dependencies to workspace root when possible
- Enable package scripts to reference other workspace packages