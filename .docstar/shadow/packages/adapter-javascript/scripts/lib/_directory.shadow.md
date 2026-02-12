# packages\adapter-javascript\scripts\lib/
@generated: 2026-02-12T21:00:50Z

## Overall Purpose

This directory contains pure utility modules for managing js-debug dependency acquisition and asset selection. It provides environment-driven vendoring strategies and GitHub release asset selection logic to support the JavaScript adapter's build and development workflows.

## Key Components

### Asset Selection (`js-debug-helpers.js`)
- **`selectBestAsset(assets)`**: Main entry point for selecting optimal js-debug assets from GitHub releases
- **`getArchiveType(name)`**: Archive format detection (tgz, zip, vsix)
- **`normalizePath(p)`**: Cross-platform path display normalization

### Vendoring Strategy (`vendor-strategy.js`)
- **`determineVendoringPlan(env)`**: Main entry point for vendoring mode selection
- **`parseEnvBool(v)`**: Environment variable boolean parsing utility

## Public API Surface

**Primary Entry Points:**
- `selectBestAsset(assets)` - Asset selection from GitHub API responses
- `determineVendoringPlan(env = process.env)` - Vendoring strategy determination

**Return Types:**
- Asset selection returns GitHub asset object with optimal js-debug bundle
- Vendoring plan returns mode objects: `local`, `prebuilt-then-source`, or `prebuilt-only`

## Internal Organization & Data Flow

1. **Environment Analysis**: `determineVendoringPlan()` examines environment variables (`JS_DEBUG_LOCAL_PATH`, `JS_DEBUG_BUILD_FROM_SOURCE`) to determine acquisition strategy
2. **Asset Selection**: When downloading from GitHub, `selectBestAsset()` applies sophisticated filtering and ranking to choose the best js-debug asset
3. **Path Handling**: Cross-platform path normalization supports consistent asset management

## Important Patterns

- **Pure Functions**: All utilities are side-effect-free and deterministic for reliable testing
- **Environment-Driven**: Configuration through environment variables rather than config files
- **Preference Hierarchies**: Both modules implement ranking systems (server > dap > generic assets; tgz > zip formats)
- **Fallback Strategies**: Graceful degradation from preferred to acceptable options
- **Error Transparency**: Descriptive errors with available options when selection fails

## Dependencies & Constraints

- Zero external dependencies - uses only built-in Node.js/JavaScript APIs
- Expects GitHub API response format for asset objects
- VSIX files treated as zip archives for extraction compatibility
- Path normalization is display-only, not filesystem-safe