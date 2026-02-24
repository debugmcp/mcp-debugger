# packages\mcp-debugger\tsconfig.json
@source-hash: 2e522dbbccaf4ae2
@generated: 2026-02-24T01:54:03Z

TypeScript configuration file for the mcp-debugger package that extends the root workspace configuration with specialized build settings for a composite project.

**Build Configuration:**
- Extends root tsconfig.json (L2) with package-specific overrides
- Composite project setup (L7) enabling project references for incremental builds
- Output directory configured to `./dist` (L5-6) for both compiled JS and declaration files
- Declaration file generation enabled (L9) with source maps disabled (L10)

**Project Structure:**
- Source files included from `./src/**/*` (L12)
- Project references (L13-19) establish dependencies on:
  - Shared utilities package (L14)
  - JavaScript adapter (L15) 
  - Python adapter (L16)
  - Mock adapter for testing (L17)
  - Root source configuration (L18)

**Key Settings:**
- Root directory set to workspace root `../..` (L4) for proper path resolution
- Emission enabled (L8) overriding potential workspace defaults
- Supports incremental compilation through composite project architecture

This configuration enables the mcp-debugger to compile with proper type checking and dependency resolution across the MCP adapter ecosystem while generating distributable declaration files.