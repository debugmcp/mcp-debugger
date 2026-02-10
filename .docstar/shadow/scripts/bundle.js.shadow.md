# scripts/bundle.js
@source-hash: e446cc34cebb3883
@generated: 2026-02-10T00:41:59Z

## Purpose
Node.js build script that bundles the MCP (Model Context Protocol) debugger server and its proxy component into standalone executable files using esbuild.

## Key Functions

**bundle() (L10-173)**: Main bundling orchestrator that:
- Creates main application bundle from `dist/index.js` to `dist/bundle.cjs`
- Injects critical console silencing code to prevent MCP protocol corruption
- Creates secondary proxy bundle from `dist/proxy/dap-proxy-entry.js`
- Performs file operations and bundle analysis

## Critical Architecture Patterns

**Console Silencing Injection (L39-102)**: 
- Prepends runtime code that detects stdio/SSE transport modes via CLI arguments
- Disables all console output methods to prevent stdout pollution that breaks MCP protocol
- Uses sophisticated argument parsing with quote stripping and keyword matching
- Applied conditionally based on `--transport=stdio/sse` flags or `CONSOLE_OUTPUT_SILENCED` env var

**Dual Bundle Strategy**:
- Main bundle (L15-34): Minified, CJS format, targets Node 18, keeps `fsevents` external
- Proxy bundle (L131-150): Unminified for debugging, includes all dependencies, targets Node 20, inline sourcemaps

## Dependencies
- `esbuild`: Primary bundling engine
- `fs`: File system operations for bundle modification and copying
- `path`: Path manipulation for proxy file handling

## Bundle Configuration Details
- Main bundle uses hardcoded paths (`/app/dist`) for container deployment
- Metafile generation enabled for both bundles for analysis
- Shebang line handling with regex replacement (L43)
- Proxy bootstrap file copying from `src/proxy/` to `dist/proxy/` (L104-115)

## Output Artifacts
- `dist/bundle.cjs`: Main executable bundle with console silencing
- `dist/bundle-meta.json`: Build analysis metadata
- `dist/proxy/proxy-bundle.cjs`: Proxy component bundle
- `dist/proxy/proxy-bootstrap.js`: Copied proxy bootstrap file

## Error Handling
Comprehensive try-catch with process.exit(1) on failures, bundle size reporting, and detailed esbuild analysis output for both main and proxy bundles.