# packages\mcp-debugger\scripts\bundle-cli.js
@source-hash: 374a9f4bd8071b75
@generated: 2026-02-15T09:00:57Z

## MCP Debugger CLI Build Script

**Purpose**: Production bundling script that creates distribution artifacts for the MCP debugger CLI tool, including the main CLI bundle, proxy components, and npm package artifacts.

### Core Functions

**bundleProxy() (L23-45)**
- Bundles the DAP proxy entry point using tsup
- Input: `dist/proxy/dap-proxy-entry.js` from repo root
- Output: `dist/proxy/proxy-bundle.cjs` 
- Configuration: CommonJS format, Node 18 target, bundles all externals

**bundleMockAdapterProcess() (L47-76)**
- Bundles mock adapter for testing scenarios
- Input: `packages/adapter-mock/dist/mock-adapter-process.js`
- Output: `dist/mock-adapter-process.cjs`
- Gracefully handles missing source with warnings

**bundleCLI() (L78-254)** - Main orchestration function
- Creates ESM CLI bundle with custom require shim (L99-103)
- Generates executable wrapper script (L111-124)
- Copies runtime assets from repo dist: proxy, errors, adapters, session, utils (L131-149)
- Bundles vendor debug adapters:
  - js-debug from adapter-javascript package (L157-171)
  - CodeLLDB from adapter-rust package with platform selection (L173-212)
- Creates package mirror for npm distribution (L214-220)
- Generates npm pack tarball with stable naming (L222-251)

### Key Dependencies
- tsup: TypeScript bundler
- Node.js built-ins: fs, path, child_process
- External scripts: `scripts/prepare-pack.js` for npm packaging

### Architecture Patterns
- **Multi-artifact build**: Creates CLI bundle, package mirror, and tarball simultaneously
- **Platform-aware bundling**: Respects `CODELLDB_PACKAGE_PLATFORMS` environment variable
- **Graceful degradation**: Warns about missing components rather than failing
- **Executable generation**: Creates both .mjs bundle and executable wrapper

### Build Artifacts
1. `packages/mcp-debugger/dist/**` - Runtime bundle used by CLI
2. `packages/mcp-debugger/package/dist/**` - Mirror for npm pack
3. `packages/mcp-debugger/package/debugmcp-*.tgz` - Fresh npm pack tarball
4. `packages/mcp-debugger/package/mcp-debugger-latest.tgz` - Stable name for testing

### Critical Constraints
- Requires Node 18+ target compatibility
- Depends on pre-built adapter packages (mock, javascript, rust)
- Uses aggressive bundling (noExternal: [/./]) to create standalone artifacts
- Platform-specific vendor assets are conditionally included based on availability