# packages\adapter-javascript\scripts/
@generated: 2026-02-12T21:01:09Z

## Overall Purpose and Responsibility

The `scripts` directory serves as the JavaScript adapter's build automation and dependency management system, specifically focused on vendoring Microsoft's js-debug DAP (Debug Adapter Protocol) server. It provides a complete pipeline for acquiring, building, and packaging js-debug from multiple sources with robust error handling and cross-platform compatibility.

## Key Components and Relationships

### Main Build Script (`build-js-debug.js`)
The primary orchestrator that handles the complete js-debug vendoring process:
- **Environment Configuration**: Reads JS_DEBUG_* environment variables to determine build mode
- **Multi-Strategy Acquisition**: Supports GitHub releases, source builds, and local overrides
- **Asset Processing**: Downloads, extracts, and validates js-debug artifacts
- **DAP Server Discovery**: Locates debug server entry points using sophisticated fallback logic
- **Vendoring Output**: Produces standardized `vendor/js-debug/` structure with required sidecars

### Utility Library (`lib/`)
Provides pure utility functions consumed by the main build script:
- **Asset Selection** (`js-debug-helpers.js`): Intelligent GitHub release asset filtering and ranking
- **Strategy Determination** (`vendor-strategy.js`): Environment-driven vendoring mode selection

## Public API Surface

### Main Entry Points
- **`build-js-debug.js`**: Primary script executed via npm/node for js-debug vendoring
- **`lib/js-debug-helpers.selectBestAsset(assets)`**: Asset selection from GitHub API responses
- **`lib/vendor-strategy.determineVendoringPlan(env)`**: Vendoring strategy determination

### Configuration Interface
Environment variables control behavior:
- `JS_DEBUG_VERSION`: Target release version or 'latest'
- `JS_DEBUG_LOCAL_PATH`: Local override path for development
- `JS_DEBUG_BUILD_FROM_SOURCE`: Force source compilation
- `JS_DEBUG_FORCE_REBUILD`: Bypass caching
- `GH_TOKEN`: GitHub API authentication

## Internal Organization and Data Flow

1. **Strategy Planning**: `vendor-strategy.js` analyzes environment to determine acquisition mode (local/prebuilt/source)
2. **Asset Resolution**: For GitHub releases, `js-debug-helpers.js` selects optimal assets from API responses
3. **Acquisition Pipeline**: Main script executes chosen strategy with retry logic and validation
4. **Server Discovery**: Multi-fallback logic locates DAP server entry points across different js-debug packaging formats
5. **Standardization**: All paths converge to uniform `vendor/js-debug/` output with required CommonJS structure

## Important Patterns and Conventions

### Robustness Patterns
- **Multi-Strategy Fallback**: Graceful degradation from preferred to acceptable acquisition methods
- **Comprehensive Error Handling**: Actionable error messages with platform-specific guidance
- **Idempotent Execution**: Cache-aware operations with force-rebuild override capability
- **Cross-Platform Compatibility**: Windows shell fallback and path normalization

### Architectural Principles
- **Pure Utility Functions**: Side-effect-free helpers enable reliable testing and composition
- **Environment-Driven Configuration**: Eliminates config file dependencies while supporting CI/development workflows
- **Deterministic Output**: SHA256 validation and manifest generation ensure reproducible builds
- **Dependency Isolation**: Minimal external dependencies with robust vendoring of critical assets

## Integration Context

This module bridges the JavaScript adapter's runtime requirements with Microsoft's js-debug project lifecycle, handling version mismatches, packaging variations, and build environment diversity while maintaining a consistent DAP server interface for the adapter's debugging functionality.