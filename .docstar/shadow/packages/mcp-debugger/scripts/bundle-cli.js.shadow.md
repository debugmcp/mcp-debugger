# packages/mcp-debugger/scripts/bundle-cli.js
@source-hash: c0db340943686f1e
@generated: 2026-02-10T21:25:36Z

## MCP Debugger CLI Bundle Script

**Purpose:** Production build script that creates distributable artifacts for the MCP debugger CLI tool, including proxy bundles and vendor dependencies.

### Core Functions

**bundleProxy() (L23-45)**
- Bundles the DAP proxy entry point using tsup
- Creates CommonJS bundle at `dist/proxy/proxy-bundle.cjs`
- Configured for Node.js 18+ with all external dependencies bundled
- Sources from `dist/proxy/dap-proxy-entry.js` in repo root

**bundleCLI() (L47-196)**
- Main bundling orchestrator that creates three distribution artifacts
- Cleans and rebuilds `packages/mcp-debugger/dist/`
- Creates ESM bundle with `.mjs` extension and Node.js shim banner
- Generates executable wrapper script `cli` that imports `cli.mjs`
- Copies runtime assets from repo-wide dist (proxy, errors, adapters, session, utils)
- Handles vendor dependencies for JavaScript and Rust debugging adapters
- Mirrors bundle to `package/dist/` and generates npm pack tarball

### Key Dependencies & Architecture

**Build Tools:**
- `tsup` for TypeScript bundling (L12)
- Node.js built-ins for filesystem operations and child processes (L13-16)

**Directory Structure:**
- `packageRoot`: Current package directory (L20)
- `repoRoot`: Monorepo root for shared assets (L21)
- Sources CLI from `src/cli-entry.ts` (L56)

### Vendor Asset Handling

**JavaScript Debug Adapter (L123-137)**
- Copies `js-debug` vendor directory from `packages/adapter-javascript/vendor/`
- Provides fallback warnings if vendor assets missing

**Rust Debug Adapter (L139-178)**
- Handles CodeLLDB vendor assets with platform-specific copying
- Respects `CODELLDB_PACKAGE_PLATFORMS` environment variable (L141)
- Supports multiple platforms (defaults to `linux-x64`)
- Includes platform validation and error handling

### Build Configuration Details

**CLI Bundle Config (L54-77)**
- ESM format targeting Node.js 18
- No code splitting, sourcemaps, or external dependencies
- Custom banner adds CommonJS `require` compatibility
- Output extension forced to `.mjs`

**Proxy Bundle Config (L26-42)**
- CommonJS format for maximum compatibility
- All dependencies bundled internally (`noExternal: [/./]`)
- Node.js platform with shims enabled

### Output Artifacts

1. `packages/mcp-debugger/dist/` - Runtime bundle used by CLI
2. `packages/mcp-debugger/package/dist/` - Mirror for npm packaging  
3. `packages/mcp-debugger/package/debugmcp-*.tgz` - Fresh npm pack tarball

### Error Handling

- Top-level try-catch with process exit on failure (L198-203)
- Individual vendor copy operations wrapped in try-catch blocks
- Comprehensive warning messages for missing dependencies