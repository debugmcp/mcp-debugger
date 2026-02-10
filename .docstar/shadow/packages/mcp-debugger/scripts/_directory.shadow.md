# packages/mcp-debugger/scripts/
@generated: 2026-02-09T18:16:03Z

## Purpose & Responsibility

The `packages/mcp-debugger/scripts` directory contains the complete build automation system for the MCP debugger CLI distribution. This module orchestrates the transformation of the development codebase into production-ready, distributable bundles with all necessary runtime assets and vendor dependencies.

## Core Components

**bundle-cli.js**: The primary build orchestrator that executes a comprehensive bundling pipeline, handling both JavaScript compilation and asset management. This script serves as the single entry point for creating distribution-ready packages.

## Build Pipeline Architecture

The directory implements a sophisticated multi-stage build process:

1. **Component Bundling**: Creates optimized bundles for both CLI (ESM format) and DAP proxy (CommonJS) components using tsup
2. **Runtime Assembly**: Generates executable wrapper scripts with proper shebangs and copies essential runtime assets
3. **Vendor Integration**: Conditionally includes platform-specific debugger binaries (js-debug, CodeLLDB) based on availability and platform targeting
4. **Package Creation**: Produces both mirrored package structure and npm tarball for distribution

## Key Entry Points

- **Main Build Command**: `bundle-cli.js` serves as the primary entry point for the entire build process
- **bundleProxy()**: Specialized function for DAP proxy component bundling
- **bundleCLI()**: Comprehensive CLI bundling orchestrator handling all distribution artifacts

## Internal Organization

The build system follows a layered approach:
- **Source Processing**: TypeScript compilation via tsup with environment-specific configurations
- **Asset Management**: Systematic copying of runtime directories (proxy, errors, adapters, session, utils)
- **Vendor Handling**: Platform-aware inclusion of debugging tool binaries with graceful fallback
- **Distribution Packaging**: Dual-output system creating both development mirrors and npm-ready tarballs

## Important Patterns

- **Graceful Degradation**: Missing vendor components generate warnings but don't break the build
- **Platform Awareness**: Environment variables control platform-specific binary inclusion
- **Execution Safety**: Wrapper scripts ensure proper CLI execution with shebang handling
- **Path Resolution**: Dynamic calculation of repository structure enables flexible deployment

This build system enables the MCP debugger to be distributed as a self-contained package with all necessary runtime dependencies and debugger tools included.