# packages/adapter-javascript/scripts/
@generated: 2026-02-10T01:19:58Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/scripts` directory provides a comprehensive vendoring system for Microsoft's js-debug DAP (Debug Adapter Protocol) server. This module handles the acquisition, building, and installation of the js-debug dependency into the adapter's vendor directory through multiple strategies including prebuilt GitHub releases, source compilation, and local development overrides.

## Key Components and Integration

### Core Build Orchestrator (`build-js-debug.js`)
The primary entry point that coordinates the entire vendoring process. Implements multiple acquisition strategies with robust error handling, retry logic, and cross-platform compatibility. Handles environment configuration, GitHub API interactions, asset downloading, archive extraction, and final vendoring operations.

### Support Library (`lib/`)
Provides foundational utilities that the main build script depends on:
- **Asset Selection Logic**: Intelligent preference algorithms for choosing optimal js-debug assets from GitHub releases
- **Strategy Determination**: Environment-driven configuration parsing to select appropriate vendoring approaches
- **Cross-platform Utilities**: Path normalization and environment variable handling

The library implements a clean separation between strategy determination (how to acquire) and asset selection (which artifacts to use).

## Public API Surface

### Main Entry Points
- **`build-js-debug.js`**: Primary vendoring script invoked during build process
  - Supports environment variables: `JS_DEBUG_VERSION`, `JS_DEBUG_FORCE_REBUILD`, `JS_DEBUG_LOCAL_PATH`, `GH_TOKEN`
  - Produces deterministic output in `vendor/js-debug/` with CommonJS boundaries
  - Returns exit code 0 on success, non-zero with actionable error messages

### Library Functions
- **`selectBestAsset(assets)`**: Chooses optimal asset from GitHub release metadata
- **`determineVendoringPlan(env)`**: Analyzes environment to determine acquisition strategy
- **Supporting utilities**: Path normalization and boolean environment parsing

## Internal Organization and Data Flow

```
Environment Variables → Strategy Determination → Asset Selection → Acquisition → Vendoring
```

1. **Configuration Phase**: Environment analysis determines vendoring mode (local/prebuilt/source)
2. **Discovery Phase**: GitHub API interaction or local path validation
3. **Acquisition Phase**: Download, extract, or build dependencies as needed
4. **Vendoring Phase**: Install to vendor directory with required sidecars and CommonJS setup

## Important Patterns and Conventions

### Vendoring Strategies
- **Local Override**: Direct file copy from development paths (`JS_DEBUG_LOCAL_PATH`)
- **Prebuilt-Only**: GitHub release downloads with asset preference algorithms
- **Prebuilt-Then-Source**: Hybrid approach with source build fallback on prebuilt failure
- **Source-Only**: Full build-from-source with auto-detected package managers

### Architectural Design
- **Idempotent Operations**: Cache-aware execution with force-rebuild capability
- **Comprehensive Error Handling**: Platform-specific guidance and retry mechanisms
- **Cross-Platform Compatibility**: Windows shell fallbacks and executable extensions
- **Deterministic Output**: SHA256 checksums and provenance metadata in manifest.json

### Runtime Guarantees
- Always produces `vsDebugServer.js` and `vsDebugServer.cjs` with CommonJS enforcement
- Validates presence of critical sidecars (`bootloader.js`, `hash.js`, WebAssembly files)
- Creates isolated CommonJS module boundary via local `package.json`
- Maintains offline development capability through local override mechanisms

This module serves as the critical bridge between the JavaScript adapter and Microsoft's js-debug infrastructure, ensuring reliable and reproducible dependency management across development and production environments.