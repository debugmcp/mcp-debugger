# packages/adapter-javascript/scripts/
@generated: 2026-02-09T18:16:20Z

## Purpose and Responsibility

The `packages/adapter-javascript/scripts` directory contains the build infrastructure for vendoring Microsoft's js-debug Debug Adapter Protocol (DAP) server into the JavaScript adapter. This module orchestrates multiple acquisition strategies—from prebuilt GitHub releases to build-from-source fallbacks—ensuring reliable debugging infrastructure deployment across development and production environments.

## Key Components and Relationships

**Core Build Orchestrator (`build-js-debug.js`)**
- Main entry point that coordinates the entire vendoring process
- Implements environment-driven strategy pattern using utilities from `lib/` 
- Handles network operations, archive extraction, build-from-source compilation, and sidecar asset management
- Produces consistent output in `vendor/js-debug/` with CommonJS enforcement

**Strategy Library (`lib/`)**
- `vendor-strategy.js`: Environment variable parsing and vendoring mode determination
- `js-debug-helpers.js`: GitHub asset selection and cross-platform path utilities
- Pure, side-effect-free functions that enable testable build logic

**Component Data Flow:**
1. Environment assessment via `lib/vendor-strategy.js` determines acquisition mode (local/prebuilt/source)
2. Asset selection via `lib/js-debug-helpers.js` chooses optimal GitHub release artifacts
3. Main orchestrator executes chosen strategy with resilient network operations and fallback handling
4. Final stage ensures CommonJS compatibility and complete sidecar asset deployment

## Public API Surface

**Main Entry Points:**
- `node build-js-debug.js` - Primary build command with environment-driven behavior
- `JS_DEBUG_VERSION` - Target js-debug version (defaults to latest)
- `JS_DEBUG_LOCAL_PATH` - Override with local js-debug directory
- `JS_DEBUG_BUILD_FROM_SOURCE` - Force source compilation
- `JS_DEBUG_FORCE_REBUILD` - Skip cache validation

**Library Utilities:**
- `determineVendoringPlan(env)` - Strategy selection based on environment
- `selectBestAsset(assets)` - Optimal GitHub release asset detection
- `normalizePath(p)` - Cross-platform path display formatting

## Internal Organization

**Acquisition Strategies:**
- **Prebuilt (Preferred)**: Downloads official GitHub releases with exponential backoff retry
- **Local Override**: Direct file copying from `JS_DEBUG_LOCAL_PATH`
- **Build-from-Source**: Git clone + package manager detection + compilation fallback

**Resilience Patterns:**
- Comprehensive retry logic for all network operations with rate limit detection
- Multi-format archive support (tgz, zip, vsix) with intelligent asset prioritization
- Hierarchical server entry point discovery with fallback search paths
- Cache validation based on complete artifact presence (main + sidecars)

**Output Guarantees:**
- Deterministic file set in `vendor/js-debug/` regardless of acquisition method
- CommonJS module enforcement via `.cjs` extension and local `package.json`
- Complete sidecar asset deployment (bootloader, hash, watchdog, binary dependencies)
- Cross-platform compatibility with Windows/Unix shell command generation

## Architecture Notes

This module bridges the gap between the adapter's runtime debugging needs and Microsoft's js-debug distribution strategy. It abstracts away the complexity of multiple acquisition methods while ensuring consistent, reliable deployment of debugging infrastructure. The separation of strategy logic into pure library functions enables comprehensive testing while the main orchestrator handles all side effects and system interactions.