# packages/mcp-debugger/scripts/
@generated: 2026-02-10T01:19:33Z

## Overview

This directory contains build automation scripts for packaging and distributing the MCP debugger CLI tool. It orchestrates the complete build pipeline from TypeScript source to distributable npm packages with embedded runtime dependencies.

## Key Components

### bundle-cli.js
The primary build orchestrator that handles the complete packaging workflow:

- **Proxy Bundling**: Creates CommonJS bundles for DAP (Debug Adapter Protocol) proxy components
- **CLI Bundling**: Compiles TypeScript CLI to ESM format with Node 18 compatibility
- **Asset Management**: Copies selective runtime dependencies from repo-level builds
- **Vendor Integration**: Handles platform-specific debug adapter payloads (JavaScript via js-debug, Rust via CodeLLDB)
- **Distribution Packaging**: Creates npm-ready packages with tarballs for distribution

## Public API Surface

### Main Entry Points
- **`bundleProxy()`**: Builds proxy transport bundles for SSE/stdio communication
- **`bundleCLI()`**: Primary orchestration function managing the complete build pipeline

### Build Outputs
- `packages/mcp-debugger/dist/`: Runtime bundle for local execution
- `packages/mcp-debugger/package/dist/`: Mirrored artifacts for npm packaging
- `packages/mcp-debugger/package/debugmcp-*.tgz`: Distribution-ready npm tarball

## Internal Organization & Data Flow

1. **Bundling Phase**: TypeScript compilation using tsup with aggressive dependency inlining
2. **Asset Collection**: Selective copying of runtime components (proxy, errors, adapters, session, utils)
3. **Vendor Integration**: Platform-aware inclusion of debug adapter binaries with environment-based filtering
4. **Distribution Preparation**: File mirroring and npm pack generation for publishing

## Important Patterns

- **Platform Awareness**: Uses CODELLDB_PACKAGE_PLATFORMS environment variable for cross-platform builds
- **Defensive File Operations**: Employs shell commands over Node.js fs APIs for better permission handling
- **Graceful Degradation**: Warns about missing vendor directories rather than failing builds
- **Executable Generation**: Creates proper shebang wrappers for cross-platform CLI execution
- **Error Handling**: Process-level error management with appropriate exit codes

The scripts directory serves as the build system foundation, transforming development artifacts into production-ready distribution packages with all necessary runtime dependencies embedded.