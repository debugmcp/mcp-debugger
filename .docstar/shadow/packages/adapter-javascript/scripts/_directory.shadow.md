# packages\adapter-javascript\scripts/
@children-hash: 22355bd75980c4bf
@generated: 2026-02-15T09:01:38Z

## Overall Purpose and Responsibility

The `scripts` directory serves as the JavaScript debug adapter's dependency management system, responsible for acquiring, building, and vendoring Microsoft's `vscode-js-debug` DAP server into the local `vendor/js-debug/` directory. This module provides a comprehensive solution for obtaining debug server artifacts through multiple acquisition strategies while maintaining cross-platform compatibility and robust error handling.

## Key Components and Relationships

### Main Orchestrator (`build-js-debug.js`)
The primary automation script that coordinates the entire vendoring process. It integrates with the utility library to determine acquisition strategy, then executes the appropriate workflow:
- **Strategy Execution**: Uses `vendor-strategy.js` to determine acquisition mode based on environment
- **Asset Selection**: Leverages `js-debug-helpers.js` for intelligent GitHub release asset selection
- **Multi-Modal Acquisition**: Implements four distinct acquisition strategies with fallback chains
- **Post-Processing**: Handles CommonJS conversion, sidecar validation, and manifest generation

### Utility Library (`lib/`)
Provides core support functions consumed by the main orchestrator:
- **`js-debug-helpers.js`**: Pure functions for GitHub asset analysis and selection with sophisticated preference ranking
- **`vendor-strategy.js`**: Environment-driven configuration system that translates environment variables into structured acquisition plans

## Public API Surface

**Primary Entry Point:**
- `build-js-debug.js` - Main script executable via Node.js for complete vendoring workflow

**Library Functions:**
- `selectBestAsset(assets)` - Intelligent asset selection from GitHub release data
- `determineVendoringPlan(env)` - Strategy determination based on environment configuration
- `getArchiveType(name)` - Archive format detection for download processing
- `normalizePath(p)` - Cross-platform path display normalization

## Internal Organization and Data Flow

1. **Configuration Phase**: Environment analysis determines acquisition strategy via `determineVendoringPlan()`
2. **Strategy Execution**: Main orchestrator branches to appropriate acquisition mode:
   - **Local Override**: Direct file copy from `JS_DEBUG_LOCAL_PATH`
   - **Prebuilt Acquisition**: GitHub release download with `selectBestAsset()` optimization
   - **Source Build**: Git clone, dependency installation, and Gulp compilation
   - **Hybrid Mode**: Prebuilt download with optional source build override
3. **Post-Processing**: CommonJS enforcement, sidecar validation, and provenance tracking
4. **Output Generation**: Deterministic artifact placement with SHA256 checksums and metadata

## Important Patterns and Conventions

- **Environment-Driven Configuration**: All behavior controlled via environment variables with sensible defaults
- **Idempotent Execution**: Cache-aware operation with force-rebuild override capability
- **Comprehensive Error Handling**: Actionable error messages with platform-specific guidance and retry logic
- **Cross-Platform Compatibility**: Windows shell fallbacks and platform-agnostic path handling
- **Deterministic Output**: SHA256 checksums, structured manifests, and consistent artifact organization
- **Fallback Chains**: Multi-strategy server discovery and graceful degradation on acquisition failures
- **Side-Effect Isolation**: Pure utility functions with no global state modifications

The module ensures reliable DAP server availability across diverse deployment scenarios while maintaining transparency through detailed logging and provenance tracking.