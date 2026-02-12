# packages\mcp-debugger\scripts\bundle-cli.js
@source-hash: 3b86185d19ecdcdd
@generated: 2026-02-12T21:05:27Z

## MCP Debugger CLI Build Script

**Primary Purpose**: Build script that bundles and packages the MCP debugger CLI for distribution, creating multiple output artifacts including runtime bundles and npm packages.

### Core Functions

**bundleProxy() (L23-45)**  
Builds the DAP proxy bundle using tsup with CommonJS format targeting Node.js 18. Outputs proxy-bundle.cjs to dist/proxy/ directory. Uses aggressive bundling with noExternal: [/./] to include all dependencies.

**bundleCLI() (L47-208)**  
Main bundling function that orchestrates the complete build pipeline:
- Bundles CLI entry point from src/cli-entry.ts to ESM format (L54-77)
- Creates executable wrapper script with shebang (L79-93)  
- Copies runtime assets from repo dist to package dist (L98-118)
- Handles vendor payloads for JavaScript and Rust debugging (L123-178)
- Mirrors dist to package/ directory for npm packaging (L180-186)
- Generates npm pack tarball using external prepare-pack script (L188-205)

### Key Build Configuration

**CLI Bundle Config (L54-77)**:
- ESM format with .mjs extension
- Node.js 18 target with shims disabled
- Adds require() compatibility banner for ESM
- Aggressive external bundling (noExternal: [/./])

**Proxy Bundle Config (L26-42)**:
- CommonJS format targeting Node.js 18
- Bundles from repo root dist/proxy/dap-proxy-entry.js
- All dependencies included via noExternal pattern

### Asset Management

**Runtime Assets (L98-118)**:
Copies ['proxy', 'errors', 'adapters', 'session', 'utils'] directories from repo dist, filtering for .js files (excluding .d.ts).

**Vendor Payloads**:
- **js-debug**: Copies JavaScript debugging adapter from packages/adapter-javascript/vendor (L123-137)
- **CodeLLDB**: Copies Rust debugging adapter with platform-specific support via CODELLDB_PACKAGE_PLATFORMS env var (L139-178)

### Output Artifacts

1. **packages/mcp-debugger/dist/**: Main runtime bundle with executable CLI wrapper
2. **packages/mcp-debugger/package/dist/**: Mirror copy for npm packaging  
3. **packages/mcp-debugger/package/debugmcp-*.tgz**: Fresh npm pack tarball

### Dependencies & Architecture

**External Dependencies**: tsup (bundler), node:fs, node:path, node:child_process  
**Build Tools**: Uses external prepare-pack.js script for npm packaging workflow  
**Platform Handling**: Conditional executable permissions for non-Windows platforms (L91-93)

### Environment Configuration

**CODELLDB_PACKAGE_PLATFORMS**: Controls which CodeLLDB platforms to include (defaults to 'linux-x64')  
**Error Handling**: Graceful degradation for missing vendor directories with clear warning messages

The script implements a comprehensive build pipeline that handles both the core CLI bundling and the complex vendor asset management required for multi-language debugging support.