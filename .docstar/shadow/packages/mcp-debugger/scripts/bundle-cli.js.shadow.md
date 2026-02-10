# packages/mcp-debugger/scripts/bundle-cli.js
@source-hash: bcf04facb9fd8345
@generated: 2026-02-10T00:41:23Z

**Purpose**: Node.js build script that bundles the MCP debugger CLI and its dependencies for distribution using tsup bundler.

**Key Functions**:
- `bundleProxy()` (L23-45): Builds proxy bundle from DAP proxy entry point
  - Creates `dist/proxy/proxy-bundle.cjs` as CommonJS bundle for SSE/stdio transports
  - Uses tsup with aggressive bundling (noExternal for all modules)
- `bundleCLI()` (L47-213): Main CLI bundling function orchestrating the complete build process
  - Bundles TypeScript CLI to ESM format with Node 18 target
  - Creates executable wrapper script with shebang (L81-93)
  - Copies runtime assets from repo-level dist directories (L98-118)
  - Handles vendor directory copying for debug adapters (L123-190)
  - Mirrors build artifacts to package directory for npm distribution (L192-203)
  - Generates npm pack tarball (L205-210)

**Build Outputs**:
- `packages/mcp-debugger/dist/`: Primary runtime bundle
- `packages/mcp-debugger/package/dist/`: Mirror for npm packaging
- `packages/mcp-debugger/package/debugmcp-*.tgz`: npm pack tarball

**Dependencies & Architecture**:
- Uses tsup for TypeScript bundling with ESM output and require() shimming
- Copies selective runtime assets: proxy, errors, adapters, session, utils (L100)
- Handles platform-specific debug adapter payloads:
  - JavaScript: js-debug vendor directory (L123-146)
  - Rust: CodeLLDB with platform filtering via CODELLDB_PACKAGE_PLATFORMS env var (L148-190)
- Uses shell commands (`cp`, `rm`) instead of fs.cpSync for better permission handling

**Key Patterns**:
- Defensive copying with cleanup of existing destinations to avoid permission issues
- Platform-aware bundling with environment variable configuration
- Graceful degradation with warnings when vendor directories are missing
- Error handling with process.exit(1) on build failure (L215-220)