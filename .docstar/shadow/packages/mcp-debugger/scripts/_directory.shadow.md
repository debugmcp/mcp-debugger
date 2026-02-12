# packages\mcp-debugger\scripts/
@generated: 2026-02-12T21:00:55Z

## MCP Debugger Scripts Directory

**Purpose:** Build automation and packaging infrastructure for the MCP debugger CLI tool. This directory contains scripts that orchestrate the creation of distributable artifacts, including CLI bundles, proxy components, and vendor dependencies required for multi-language debugging support.

### Core Responsibilities

This directory serves as the build pipeline for the MCP debugger package, handling:

- **CLI Distribution Creation:** Bundling the debugger CLI into executable artifacts
- **Proxy Component Packaging:** Creating standalone DAP (Debug Adapter Protocol) proxy bundles  
- **Vendor Asset Management:** Copying and organizing third-party debugging adapters
- **Cross-Platform Support:** Managing platform-specific dependencies and assets
- **npm Package Preparation:** Generating ready-to-publish distribution packages

### Key Components

**bundle-cli.js**
- Primary build orchestrator and entry point for the packaging process
- Coordinates multiple bundling operations through `bundleProxy()` and `bundleCLI()` functions
- Manages complex asset copying from monorepo shared resources
- Handles vendor dependencies for JavaScript (js-debug) and Rust (CodeLLDB) debugging adapters

### Build Architecture & Data Flow

The build process follows a structured pipeline:

1. **Bundle Creation:** Uses tsup to create optimized bundles for both CLI and proxy components
2. **Asset Aggregation:** Copies shared runtime assets from repo-wide distributions (proxy, errors, adapters, session, utils)
3. **Vendor Integration:** Incorporates third-party debugging adapters with platform-specific handling
4. **Distribution Packaging:** Creates multiple output formats including ESM bundles, executable wrappers, and npm tarballs

### Public API Surface

**Main Entry Point:**
- `bundle-cli.js` - Execute via Node.js to trigger complete build process

**Key Functions:**
- `bundleProxy()` - Creates DAP proxy bundle for debugging communication
- `bundleCLI()` - Main orchestrator for CLI packaging and distribution

### Internal Organization

**Directory Structure Management:**
- Sources from `packages/mcp-debugger/src/` 
- Outputs to `packages/mcp-debugger/dist/` for runtime use
- Mirrors to `packages/mcp-debugger/package/dist/` for npm packaging
- Integrates with monorepo shared assets from repo root

**Vendor Asset Handling:**
- JavaScript debugging: `js-debug` adapter integration
- Rust debugging: CodeLLDB with configurable platform support
- Environment-driven platform selection via `CODELLDB_PACKAGE_PLATFORMS`

### Important Patterns

**Build Configuration:**
- ESM-first approach with CommonJS compatibility shims
- Node.js 18+ target with comprehensive dependency bundling
- Platform-aware vendor asset management
- Graceful degradation with warning messages for missing dependencies

**Error Handling:**
- Comprehensive try-catch blocks around vendor operations
- Process-level error handling with explicit exit codes
- Informative warning messages for missing optional dependencies

This scripts directory enables the MCP debugger to be distributed as a self-contained CLI tool with embedded debugging capabilities for multiple programming languages, while maintaining compatibility across different deployment environments.