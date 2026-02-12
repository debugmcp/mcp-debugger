# packages/mcp-debugger/scripts/
@generated: 2026-02-11T23:47:37Z

## MCP Debugger Scripts Directory

**Purpose:** Contains build automation scripts for packaging and distributing the MCP debugger CLI tool as production-ready artifacts with all necessary runtime dependencies.

### Core Responsibility

This directory orchestrates the complete build pipeline for the MCP debugger, transforming TypeScript source code and vendor dependencies into distributable packages. It handles the complex task of bundling multiple runtime components (CLI, proxy, debug adapters) while managing platform-specific vendor assets.

### Key Components

**bundle-cli.js**
- Main build orchestrator that creates production distributions
- Handles TypeScript compilation and bundling via tsup
- Manages vendor asset collection from multiple adapter packages
- Generates executable CLI scripts and npm-ready tarballs

### Build Pipeline Architecture

**Multi-Stage Bundling Process:**
1. **Proxy Bundle:** Creates CommonJS proxy bundle for maximum compatibility
2. **CLI Bundle:** Generates ESM CLI with Node.js compatibility shims
3. **Asset Collection:** Copies runtime dependencies from repo-wide distributions
4. **Vendor Management:** Handles platform-specific debug adapter assets
5. **Package Generation:** Creates npm-ready tarballs for distribution

**Directory Flow:**
```
packages/mcp-debugger/src/ → dist/ → package/dist/ → *.tgz
```

### Public API & Entry Points

**Primary Build Command:**
- `node bundle-cli.js` - Executes complete build pipeline

**Key Functions:**
- `bundleProxy()` - Creates DAP proxy distribution bundle
- `bundleCLI()` - Main orchestrator for all CLI build operations

### Vendor Asset Management

**Multi-Platform Support:**
- JavaScript debug adapters via `js-debug` vendor assets
- Rust debug adapters via CodeLLDB with platform-specific binaries
- Environment-driven platform selection (`CODELLDB_PACKAGE_PLATFORMS`)
- Graceful fallback handling for missing vendor dependencies

### Output Artifacts

**Runtime Distribution:**
- `packages/mcp-debugger/dist/` - Complete CLI runtime with all dependencies
- Platform-specific debug adapter binaries
- Executable wrapper scripts with Node.js compatibility

**Packaging Distribution:**
- `packages/mcp-debugger/package/dist/` - npm-ready mirror
- `debugmcp-*.tgz` - Fresh tarball for distribution

### Integration Patterns

**Monorepo Integration:**
- Sources shared assets from repo root (`dist/proxy/`, `dist/errors/`, etc.)
- Coordinates with individual adapter packages for vendor assets
- Maintains separation between development and distribution artifacts

**Build Tool Integration:**
- Uses tsup for TypeScript bundling with custom configurations
- Leverages Node.js built-ins for filesystem operations
- Integrates with npm pack for tarball generation

This directory serves as the critical bridge between development source code and production-ready CLI distributions, handling all the complexity of multi-platform builds and dependency management.