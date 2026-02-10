# packages/mcp-debugger/scripts/
@generated: 2026-02-10T21:26:18Z

## MCP Debugger Scripts Module

**Purpose:** Build automation and distribution pipeline for the MCP debugger CLI tool. This directory contains production build scripts that transform TypeScript source code into distributable artifacts with all necessary runtime dependencies.

### Key Components

**bundle-cli.js** - Primary build orchestrator that handles:
- CLI tool bundling and packaging
- Debug adapter proxy creation
- Vendor dependency management
- Distribution artifact generation

### Public API Surface

**Main Entry Points:**
- `bundleCLI()` - Complete build pipeline for CLI distribution
- `bundleProxy()` - DAP proxy bundle creation
- Direct execution via Node.js (`node bundle-cli.js`)

### Build Pipeline Architecture

The module orchestrates a multi-stage build process:

1. **Source Compilation** - Bundles TypeScript CLI entry point into ESM format
2. **Proxy Generation** - Creates CommonJS DAP proxy bundle for debugging protocol
3. **Asset Aggregation** - Copies runtime dependencies from repo-wide distribution
4. **Vendor Integration** - Handles platform-specific debug adapter assets
5. **Package Creation** - Generates final distribution artifacts and npm tarballs

### Internal Organization

**Build Tools Integration:**
- Uses `tsup` for TypeScript bundling with Node.js 18+ targeting
- Leverages Node.js built-ins for filesystem operations and process management
- Configured for both ESM (.mjs) and CommonJS (.cjs) output formats

**Directory Structure Management:**
- Sources from `packages/mcp-debugger/src/cli-entry.ts`
- Outputs to `packages/mcp-debugger/dist/` for runtime
- Mirrors to `packages/mcp-debugger/package/dist/` for npm packaging
- Pulls shared assets from repo root `dist/` directory

**Vendor Asset Handling:**
- JavaScript debug adapter: Copies `js-debug` vendor assets
- Rust debug adapter: Manages CodeLLDB platform-specific binaries
- Platform awareness via `CODELLDB_PACKAGE_PLATFORMS` environment variable
- Fallback warnings for missing dependencies

### Data Flow

```
TypeScript Source → tsup Bundle → Asset Copy → Vendor Integration → Distribution Artifacts
```

The pipeline transforms source code through multiple stages:
- CLI source bundled as ESM with Node.js compatibility shims
- Proxy components bundled as CommonJS for maximum compatibility
- Runtime assets copied from shared repository locations
- Platform-specific debug adapters integrated based on environment
- Final artifacts packaged for npm distribution

### Important Patterns

**Multi-Format Support:** Generates both ESM and CommonJS bundles to support different Node.js environments

**Platform Flexibility:** Debug adapter integration respects platform constraints while providing sensible defaults

**Error Resilience:** Comprehensive error handling with graceful degradation for missing vendor assets

**Clean Build Process:** Always rebuilds from scratch to ensure consistent output state

The scripts module serves as the critical bridge between development source code and production distribution, handling the complexity of multi-platform debug adapter integration while maintaining a simple build interface.