# packages\mcp-debugger\scripts/
@children-hash: 9536641ca0c7c82f
@generated: 2026-02-15T09:01:23Z

## MCP Debugger Scripts Directory

**Purpose**: Build and packaging infrastructure for the MCP debugger CLI tool, responsible for creating production-ready distribution artifacts from TypeScript sources and assembling multi-component bundles.

### Overall Responsibility

This directory contains the build orchestration logic that transforms the MCP debugger from development sources into deployable CLI tools. It handles bundling, packaging, and distribution artifact generation with support for multiple platforms and runtime environments.

### Key Components

**bundle-cli.js** - Primary build orchestrator that:
- Creates ESM CLI bundles with Node.js compatibility shims
- Generates executable wrapper scripts for command-line usage  
- Assembles multi-component runtime packages including proxies, adapters, and utilities
- Produces npm-ready distribution packages and tarballs
- Handles platform-specific vendor debug adapter integration

### Public API Surface

**Main Entry Point:**
- `bundleCLI()` - Complete build pipeline that produces all distribution artifacts

**Component Bundlers:**
- `bundleProxy()` - Creates DAP proxy bundle for debugger communication
- `bundleMockAdapterProcess()` - Bundles mock adapter for testing scenarios

### Internal Organization & Data Flow

The build process follows a structured pipeline:

1. **Source Bundling** - TypeScript sources are bundled into executable formats using tsup
2. **Asset Assembly** - Runtime components are copied from various package dist directories
3. **Vendor Integration** - Debug adapters (js-debug, CodeLLDB) are selectively bundled based on platform availability
4. **Package Generation** - npm-compatible package structure is mirrored and packed into tarballs
5. **Artifact Finalization** - Multiple output formats are generated for different consumption patterns

### Important Patterns

**Multi-Artifact Strategy**: Single build process creates multiple output formats (bundle, package, tarball) to support different deployment scenarios.

**Graceful Degradation**: Missing optional components (like platform-specific adapters) generate warnings rather than build failures, enabling partial builds.

**Platform Awareness**: Respects environment variables like `CODELLDB_PACKAGE_PLATFORMS` to conditionally include platform-specific assets.

**Stable Naming**: Generates both timestamped and stable-named artifacts to support both versioned releases and testing workflows.

### Critical Dependencies

- **tsup**: TypeScript bundling engine for creating optimized Node.js bundles
- **Node.js Built-ins**: File system, path manipulation, and child process execution
- **External Packages**: Depends on pre-built adapter packages (mock, javascript, rust) being available in the monorepo

This directory serves as the final assembly point where distributed TypeScript packages are consolidated into cohesive, deployable CLI tools ready for end-user consumption.