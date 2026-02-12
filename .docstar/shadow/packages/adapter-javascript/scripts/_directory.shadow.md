# packages/adapter-javascript/scripts/
@generated: 2026-02-11T23:47:58Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/scripts` directory is the build automation and dependency management system for the JavaScript adapter. Its primary responsibility is intelligently acquiring, processing, and vendoring Microsoft's js-debug DAP server into the adapter's distribution, supporting multiple acquisition strategies from local development to production builds with robust error handling and cross-platform compatibility.

## Key Components and Relationships

### Core Architecture
- **`build-js-debug.js`**: Main orchestration script that handles the complete js-debug vendoring workflow
- **`lib/vendor-strategy.js`**: Environment-driven strategy selector that determines acquisition method based on configuration
- **`lib/js-debug-helpers.js`**: Asset selection and path utilities for choosing optimal releases from GitHub API responses

### Integration Flow
1. **Strategy Determination**: `lib/vendor-strategy.js` analyzes environment variables to determine vendoring approach (local, source build, or prebuilt)
2. **Asset Selection**: `lib/js-debug-helpers.js` processes GitHub release data to identify best-match assets using sophisticated ranking algorithms
3. **Acquisition Execution**: `build-js-debug.js` orchestrates the chosen strategy, handling downloads, builds, extractions, and vendoring with comprehensive retry logic

## Public API Surface

### Main Entry Points
- **`build-js-debug.js`**: Primary CLI script for complete js-debug vendoring (`node build-js-debug.js`)
- **`determineVendoringPlan(env?)`**: Core strategy selector from vendor-strategy module
- **`selectBestAsset(assets)`**: Asset selection algorithm for GitHub releases
- **Helper utilities**: Path normalization, environment parsing, cross-platform compatibility

### Configuration Interface
- **`JS_DEBUG_VERSION`**: Target release tag or 'latest'
- **`JS_DEBUG_LOCAL_PATH`**: Local override path for development
- **`JS_DEBUG_BUILD_FROM_SOURCE`**: Force source compilation mode
- **`JS_DEBUG_FORCE_REBUILD`**: Bypass caching mechanisms
- **`GH_TOKEN`**: GitHub API authentication for rate limit mitigation

## Internal Organization and Data Flow

### Vendoring Strategy Pipeline
1. **Environment Analysis**: Strategy module determines acquisition approach based on environment variables and availability
2. **Source Resolution**: Asset selection identifies optimal GitHub releases or validates local paths
3. **Acquisition**: Downloads, extractions, or builds are executed with retry logic and error recovery
4. **Processing**: DAP server discovery locates entry points using multi-strategy fallback chains
5. **Vendoring**: Files are copied to `vendor/js-debug/` with required sidecars and CommonJS enforcement

### Multi-Strategy Support
- **Local Override**: Direct file copy from development paths
- **Prebuilt Artifacts**: GitHub release downloads with asset selection
- **Source Compilation**: Git clone and build with auto-detected package managers
- **Hybrid Mode**: Prebuilt with optional source override fallback

## Important Patterns and Conventions

### Robustness Architecture
- **Comprehensive Error Handling**: Actionable error messages with platform-specific guidance
- **Retry Mechanisms**: Exponential backoff for network operations with rate limit awareness
- **Cross-Platform Compatibility**: Windows shell fallbacks and platform-specific executable handling
- **Idempotent Execution**: Cache-aware with force-rebuild capabilities

### Quality Assurance
- **Validation**: SHA256 checksums, content-length verification, required sidecar presence
- **Deterministic Output**: Consistent file structure with provenance metadata in manifest.json
- **Runtime Invariants**: Always produces CommonJS-compatible server entry points with required dependencies

### Development Workflow Support
- **Offline Development**: Local path overrides bypass network entirely
- **CI/CD Integration**: Environment-driven configuration with sensible defaults
- **Debug Support**: Comprehensive logging and actionable error reporting for troubleshooting

This module serves as the critical foundation enabling the JavaScript adapter to reliably source and manage its DAP server dependency across diverse development and deployment environments.