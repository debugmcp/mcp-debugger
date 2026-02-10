# packages/adapter-javascript/scripts/build-js-debug.js
@source-hash: e423528ad3f1f56a
@generated: 2026-02-10T00:41:37Z

## Primary Purpose

Node.js script for vendoring Microsoft's js-debug DAP server into `vendor/js-debug/`. Supports multiple acquisition strategies: prebuilt GitHub releases, source compilation, and local overrides with robust error handling and cross-platform compatibility.

## Key Components

### Environment Configuration (L37-51)
- `VERSION`: Release tag or 'latest' via `JS_DEBUG_VERSION`
- `FORCE`: Cache bypass via `JS_DEBUG_FORCE_REBUILD`
- `GH_TOKEN`: GitHub API authentication for rate limit mitigation
- Constants define GitHub repo (`microsoft/vscode-js-debug`) and vendor paths

### Core Acquisition Functions

**GitHub Release Fetching (L108-167)**
- `getRelease(version)`: Fetches release metadata with exponential backoff retry
- Handles rate limiting (403), tag not found (404), and transient errors (5xx)
- Returns release JSON with assets array

**Asset Download (L169-217)**
- `downloadWithRetries(url, destFile)`: Downloads with timeout and retry logic
- Validates content-length header against actual bytes received
- Provides actionable 403 rate limit guidance

**Archive Processing (L219-233)**
- `extractArchive(archiveFile, type, outDir)`: Handles .tgz and .zip extraction
- Uses `tar` library for tgz, `extract-zip` for zip files

### DAP Server Discovery (L269-320)
**`findServerEntry(rootDir)`**: Multi-strategy server location with fallback chain:
1. Prefers Node/CJS bundle: `dist/vsDebugServer.js`
2. Built-from-source ESM: `dist/src/dapDebugServer.js`
3. VSIX packaging: `extension/src/dapDebugServer.js`
4. Source ESM: `js-debug/src/dapDebugServer.js`
5. BFS search for `dapDebugServer.js` or `vsDebugServer.js`

### Build-from-Source (L415-453)
**`buildFromSource(version)`**: Git clone, dependency install, and Gulp build
- Auto-detects package manager (yarn/pnpm/npm) via lockfile presence
- Cross-platform command execution with Windows shell fallback
- Skips Playwright browser downloads via environment variable

### Vendoring Strategies

**Local Override (L498-537)**
- Direct file copy from `JS_DEBUG_LOCAL_PATH`
- Validates file existence and warns on unexpected basenames
- Bypasses network entirely for offline development

**Prebuilt Artifact (L542-666)**
- Downloads best-match asset using `selectBestAsset()` helper
- Copies server entry and critical sidecars (bootloader.js, hash.js, *.wasm, *.map)
- Hard-validates required sidecars existence post-vendoring

**Hybrid Mode (L668-709)**
- `prebuilt-then-source`: Downloads prebuilt, then optionally overrides with source build
- Preserves prebuilt on source build failure with warning

## Critical Dependencies

- **External helpers**: `js-debug-helpers.js` (asset selection), `vendor-strategy.js` (plan determination)
- **Archive libraries**: `tar`, `extract-zip`
- **File system**: `fs-extra` for robust copy operations
- **Process**: `child_process.spawn` for git/npm/build commands

## Architectural Patterns

**Error Handling**: Comprehensive with actionable error messages including platform-specific command examples
**Caching**: Idempotent execution with force-rebuild override
**Cross-platform**: Windows cmd/shell fallback, platform-specific executable extensions
**Deterministic Output**: SHA256 checksums, manifest.json with provenance metadata

## Runtime Invariants

1. Always produces `vsDebugServer.js` and `vsDebugServer.cjs` (CommonJS enforcement)
2. Requires `bootloader.js` and `hash.js` sidecars for js-debug runtime
3. Creates local `package.json` with `"type": "commonjs"` boundary
4. Exit code 0 on success/cache-hit, non-zero with actionable errors

## Key Configuration Modes

- **prebuilt-only**: Default GitHub releases download
- **prebuilt-then-source**: Prebuilt with optional source override
- **local**: Direct file copy bypass for development
- **source-only**: Build-from-source fallback when prebuilt fails