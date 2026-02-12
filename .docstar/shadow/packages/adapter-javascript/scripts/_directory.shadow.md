# packages\adapter-javascript\scripts/
@generated: 2026-02-12T21:06:04Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/scripts` directory provides the complete vendoring system for Microsoft's js-debug DAP server, handling acquisition, processing, and deployment into the JavaScript adapter's vendor directory. This module serves as the critical bridge between the adapter and the external js-debug dependency, implementing multiple acquisition strategies with robust error handling and cross-platform compatibility.

## Key Components and Integration

### Core Orchestrator (`build-js-debug.js`)
The primary vendoring script that coordinates the entire acquisition pipeline:
- Environment configuration and strategy determination
- Network-based asset acquisition from GitHub releases
- Local development overrides and source compilation
- Archive processing and file system operations
- DAP server discovery with intelligent fallback chains
- Cross-platform build automation with package manager detection

### Foundation Libraries (`lib/`)
Supporting utilities that provide the decision-making logic:
- **`js-debug-helpers.js`**: Asset selection algorithms for GitHub releases with intelligent ranking
- **`vendor-strategy.js`**: Environment-driven strategy determination engine

The integration follows a clear separation: the lib utilities handle *what* and *how* decisions, while the main script executes the chosen acquisition plan with comprehensive error handling and retry logic.

## Public API Surface

### Main Entry Points
1. **`build-js-debug.js`** - Primary vendoring command
   - Executable Node.js script for CI/CD and development workflows
   - Environment-driven configuration via `JS_DEBUG_*` variables
   - Idempotent execution with force-rebuild capabilities
   - Exit codes: 0 for success/cache-hit, non-zero with actionable errors

### Supporting Functions
2. **`selectBestAsset(assets)`** - GitHub release asset selection
   - Intelligent ranking: server bundles > DAP assets > generic assets
   - Archive preference: tgz/tar.gz over zip/vsix formats

3. **`determineVendoringPlan(env)`** - Strategy resolution
   - Returns acquisition mode: `'local'` | `'prebuilt-then-source'` | `'prebuilt-only'`
   - Environment-driven with sensible defaults

## Internal Organization and Data Flow

### Acquisition Pipeline
1. **Strategy Resolution**: Environment variables determine vendoring approach
2. **Asset Discovery**: GitHub API integration with rate limiting and retry logic
3. **Download & Processing**: Archive handling with validation and extraction
4. **Server Location**: Multi-strategy DAP server discovery across build variants
5. **Vendoring**: File copying with sidecar validation and CommonJS enforcement

### Data Flow Patterns
- **Pure Functional Utilities**: Library functions are side-effect free with clear inputs/outputs
- **Imperative Orchestration**: Main script coordinates stateful operations with comprehensive error handling
- **Deterministic Output**: Always produces consistent vendor structure regardless of acquisition method

## Important Patterns and Conventions

### Acquisition Strategies
- **Local Override**: Direct file copy for offline development (`JS_DEBUG_LOCAL_PATH`)
- **Prebuilt Artifacts**: GitHub releases download with asset selection intelligence
- **Source Compilation**: Git clone + build pipeline with package manager auto-detection
- **Hybrid Mode**: Prebuilt primary with source fallback for maximum reliability

### Cross-Platform Compatibility
- Windows shell fallback for command execution
- Normalized path handling for display and filesystem operations
- Platform-specific executable extension detection

### Error Resilience
- Exponential backoff retry for network operations
- Comprehensive HTTP error handling with actionable guidance
- Graceful degradation with fallback acquisition methods
- Detailed error messages with platform-specific troubleshooting

## Runtime Invariants

1. **Consistent Output Structure**: Always produces `vsDebugServer.js` and `vsDebugServer.cjs` with required sidecars
2. **CommonJS Enforcement**: Local `package.json` with `"type": "commonjs"` boundary
3. **Provenance Tracking**: `manifest.json` with acquisition metadata and checksums
4. **Sidecar Validation**: Hard requirements for `bootloader.js`, `hash.js`, and associated WebAssembly files

This directory implements a production-ready dependency vendoring system that balances reliability, performance, and developer experience across multiple acquisition strategies and deployment environments.