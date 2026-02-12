# packages\mcp-debugger\scripts/
@generated: 2026-02-12T21:05:41Z

## MCP Debugger Build Scripts Directory

**Primary Purpose**: Contains build automation scripts responsible for bundling, packaging, and distributing the MCP debugger CLI as a complete, self-contained executable with all necessary runtime dependencies and debugging adapters.

### Core Responsibility

This directory houses the build pipeline infrastructure that transforms the MCP debugger source code into distributable artifacts. The scripts handle complex bundling requirements including multi-language debugging adapter integration, platform-specific asset management, and npm package preparation.

### Key Components

**bundle-cli.js** - Main build orchestration script that:
- Bundles the CLI application using tsup with ESM output format
- Creates executable wrapper scripts with proper shebang headers
- Manages runtime asset copying and vendor payload integration
- Handles platform-specific debugging adapter distribution
- Generates final npm package tarballs for distribution

### Public API Surface

**Main Entry Points:**
- `bundleProxy()` - Builds the DAP (Debug Adapter Protocol) proxy component as CommonJS bundle
- `bundleCLI()` - Complete CLI build pipeline including asset management and packaging

### Build Pipeline Architecture

**Multi-Stage Process:**
1. **Core Bundling** - Compiles TypeScript CLI entry point to optimized ESM bundle
2. **Proxy Integration** - Builds separate DAP proxy component for debugging protocol handling  
3. **Asset Aggregation** - Copies runtime components (proxy, errors, adapters, session, utils)
4. **Vendor Integration** - Embeds debugging adapters for JavaScript (js-debug) and Rust (CodeLLDB)
5. **Package Preparation** - Creates npm-ready package structure with fresh tarballs

### Internal Organization

**Asset Management Strategy:**
- Runtime assets filtered and copied from repo-level dist directory
- Vendor payloads conditionally included based on environment configuration
- Platform-specific handling for CodeLLDB Rust debugging support
- Executable permissions managed for cross-platform compatibility

### Key Patterns & Conventions

**Build Configuration:**
- Aggressive bundling with `noExternal: [/./]` to create self-contained artifacts  
- Node.js 18 targeting with ESM/CommonJS hybrid support
- Environment-driven vendor inclusion via `CODELLDB_PACKAGE_PLATFORMS`
- Graceful degradation for missing vendor dependencies

**Output Structure:**
- `dist/` - Primary runtime bundle with executable CLI
- `package/dist/` - Mirror structure for npm packaging
- Platform-specific vendor assets organized by debugging language support

This directory serves as the critical bridge between development source code and production distribution, handling the complex requirements of packaging a multi-language debugging tool with embedded protocol adapters and runtime dependencies.