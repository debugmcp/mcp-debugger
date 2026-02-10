# packages/adapter-javascript/scripts/
@generated: 2026-02-10T21:26:40Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/scripts` directory provides a comprehensive build and vendoring system for Microsoft's js-debug DAP server. This module handles the complex task of acquiring, building, and deploying js-debug assets into the adapter's vendor directory, supporting multiple acquisition strategies from local development to production GitHub releases.

## Key Components and How They Relate

### Primary Orchestrator (`build-js-debug.js`)
- **Main Build Script**: Central orchestrator that coordinates the entire js-debug vendoring process
- **Multi-Strategy Support**: Implements local override, prebuilt artifact download, source compilation, and hybrid approaches
- **Environment-Driven**: Uses environment variables (`JS_DEBUG_VERSION`, `JS_DEBUG_FORCE_REBUILD`, `JS_DEBUG_LOCAL_PATH`) to determine behavior

### Support Library (`lib/`)
- **Strategy Determination** (`vendor-strategy.js`): Analyzes environment to select appropriate vendoring mode
- **Asset Selection** (`js-debug-helpers.js`): Implements intelligent asset ranking and selection from GitHub releases
- **Pure Utility Functions**: Side-effect-free modules designed for testability and predictable behavior

## Public API Surface

### Main Entry Points
- **`build-js-debug.js`**: Primary script executed via npm/node for js-debug vendoring
- **Environment Configuration**: `JS_DEBUG_VERSION`, `JS_DEBUG_FORCE_REBUILD`, `JS_DEBUG_LOCAL_PATH`, `GH_TOKEN`

### Vendoring Modes
- **`local`**: Direct file copy from local development path (bypasses network)
- **`prebuilt-only`**: Downloads from GitHub releases (default production mode)
- **`prebuilt-then-source`**: Hybrid approach with source build fallback
- **`source-only`**: Build from source when prebuilt assets unavailable

### Key Output Guarantees
- Always produces `vsDebugServer.js` and `vsDebugServer.cjs` (CommonJS enforcement)
- Includes required sidecars: `bootloader.js`, `hash.js`, WASM files, source maps
- Creates local `package.json` with CommonJS boundary configuration

## Internal Organization and Data Flow

### Acquisition Pipeline
1. **Strategy Selection**: `lib/vendor-strategy.js` analyzes environment → determines vendoring plan
2. **Asset Resolution**: `lib/js-debug-helpers.js` selects optimal assets from GitHub releases
3. **Content Acquisition**: Download, extract, or build based on strategy
4. **Server Discovery**: Multi-fallback search for DAP server entry points
5. **Vendoring**: Copy server and sidecars to `vendor/js-debug/`

### Error Handling and Resilience
- **Comprehensive Retry Logic**: Exponential backoff for network operations
- **Cross-Platform Compatibility**: Windows shell fallback, platform-specific executables
- **Validation**: Content-length verification, required sidecar validation
- **Actionable Errors**: Platform-specific command examples in error messages

## Important Patterns and Conventions

### Build Determinism
- **Idempotent Execution**: Cache-aware with force-rebuild override
- **Provenance Tracking**: SHA256 checksums and manifest.json metadata
- **Version Pinning**: Supports specific releases or 'latest' resolution

### Development Workflow Support
- **Local Override**: Immediate file copy for rapid development iteration
- **Source Builds**: Full Git clone and build pipeline with auto-detected package managers
- **Hybrid Modes**: Graceful degradation between acquisition strategies

### Production Readiness
- **GitHub Rate Limit Handling**: Token authentication and 403 retry guidance
- **Archive Format Support**: tgz, zip, and VSIX extraction capabilities
- **Robust File Operations**: Uses `fs-extra` for reliable cross-platform file handling

This directory serves as the critical bridge between the adapter's runtime requirements and Microsoft's js-debug distribution ecosystem, ensuring reliable DAP server availability across diverse deployment scenarios.