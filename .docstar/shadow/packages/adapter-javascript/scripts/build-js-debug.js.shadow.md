# packages/adapter-javascript/scripts/build-js-debug.js
@source-hash: e423528ad3f1f56a
@generated: 2026-02-09T18:14:44Z

## Primary Purpose
Node.js build script that vendors Microsoft's js-debug DAP server into `vendor/js-debug/`. Supports multiple acquisition strategies: prebuilt GitHub releases (preferred), local file override, and build-from-source fallback.

## Core Architecture
**Environment-Driven Strategy Pattern**: `determineVendoringPlan()` (L497) selects acquisition mode based on env vars:
- `local`: Use `JS_DEBUG_LOCAL_PATH` directly
- `prebuilt-then-source`: Fetch GitHub release, optionally override with source build
- Controlled by `JS_DEBUG_VERSION`, `JS_DEBUG_FORCE_REBUILD`, `JS_DEBUG_BUILD_FROM_SOURCE`

**Resilient Network Operations**: All GitHub API calls use exponential backoff retry logic (L108-167, L169-217) with proper timeout handling and rate limit detection.

## Key Functions

### GitHub Release Management
- `getRelease(version)` (L108-167): Fetches release metadata with retry logic, handles 404/403 gracefully
- `downloadWithRetries(url, destFile)` (L169-217): Downloads assets with timeout/retry, validates content-length
- `selectBestAsset(assets)` (L34): Imported helper for asset selection (tgz preferred over zip)

### Artifact Processing
- `findServerEntry(rootDir)` (L269-320): Locates DAP server entry with fallback search hierarchy:
  - `dist/vsDebugServer.js` (preferred CJS bundle)
  - `dist/src/dapDebugServer.js` (built-from-source ESM)
  - `extension/src/dapDebugServer.js` (VSIX packaging)
  - `js-debug/src/dapDebugServer.js` (source ESM)
- `extractArchive(archiveFile, type, outDir)` (L219-233): Handles both tgz and zip formats

### Build-from-Source Fallback
- `buildFromSource(version)` (L415-453): Clones repo, detects package manager, builds bundle
- `detectRepoPackageManager(repoDir)` (L397-410): Prefers yarn → pnpm → npm based on lockfiles
- `execCmd(cmd, args, opts)` (L356-386): Cross-platform command execution with Windows shell fallback

### File Operations
- `sha256File(filePath)` (L322-331): Streaming hash computation
- `writeChecksum()` / `writeManifest()` (L333-350): Generates integrity metadata
- `findAllByBasename()` (L455-476): BFS search for sidecar files

## Critical Dependencies
- **External**: `tar`, `extract-zip`, `fs-extra` for archive handling
- **Internal**: `./lib/js-debug-helpers.js`, `./lib/vendor-strategy.js` for selection logic
- **Node Built-ins**: Uses Node 18+ `fetch()`, filesystem promises, crypto

## Key Behaviors

### Sidecar Asset Management (L568-604)
Copies runtime dependencies alongside main server:
- Binary assets: `.wasm`, `.node`, `.map`, `.json` 
- Critical JS: `bootloader.js`, `hash.js`, `watchdog.js`
- Vendor subdirectory containing `acorn.js`, etc.

### CommonJS Enforcement (L521, L567, L634-648)
- Creates `.cjs` copy of main artifact
- Writes local `package.json` with `"type": "commonjs"`
- Forces Node to treat js-debug as CommonJS regardless of parent package

### Cache Strategy (L479-493)
Skips rebuild only if ALL exist: `vsDebugServer.js`, `bootloader.js`, `hash.js`
Warns about missing sidecars and rebuilds to restore them.

## Exit Codes & Error Handling
- **0**: Success or cache hit
- **Non-zero**: Actionable error messages with platform-specific command examples
- Rate limit detection provides GH_TOKEN setup instructions
- Missing artifacts trigger specific troubleshooting guidance

## Architecture Notes
- **Deterministic Output**: Always produces same file set in `vendor/js-debug/`
- **Cross-Platform**: Windows cmd/PowerShell and Unix shell compatibility
- **Resilient**: Network failures don't break builds due to comprehensive fallback chain