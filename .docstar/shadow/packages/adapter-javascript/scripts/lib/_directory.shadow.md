# packages\adapter-javascript\scripts\lib/
@children-hash: 159feb902d0e51c3
@generated: 2026-02-15T09:01:22Z

## Overall Purpose
Utility library providing core functions for JavaScript debug adapter dependency management. This module handles the strategic selection and acquisition of js-debug assets from external sources, supporting multiple vendoring strategies for different deployment scenarios.

## Key Components and Relationships

### Asset Selection (`js-debug-helpers.js`)
Pure utility functions for identifying and selecting optimal js-debug assets from GitHub releases:
- **`selectBestAsset(assets)`**: Main orchestrator implementing sophisticated preference-based selection
- **`getArchiveType(name)`**: Archive format detection supporting tgz, zip, and VSIX containers
- **`normalizePath(p)`**: Cross-platform path normalization for display purposes

### Strategy Determination (`vendor-strategy.js`) 
Environment-driven configuration system for determining how dependencies should be acquired:
- **`determineVendoringPlan(env)`**: Central strategy selector returning structured plans
- **`parseEnvBool(v)`**: Environment variable parsing utility

## Public API Surface
**Main Entry Points:**
- `selectBestAsset(assets)` - Asset selection from GitHub release data
- `determineVendoringPlan(env)` - Vendoring strategy determination

**Supporting Utilities:**
- `normalizePath(p)` - Path display normalization
- `parseEnvBool(v)` - Environment boolean parsing

## Internal Organization and Data Flow

1. **Strategy Phase**: `determineVendoringPlan()` analyzes environment variables to determine acquisition mode:
   - `local`: Use local development path
   - `prebuilt-then-source`: Try prebuilt, fallback to source build
   - `prebuilt-only`: Use only prebuilt artifacts

2. **Asset Selection Phase**: `selectBestAsset()` processes GitHub API responses to identify optimal assets:
   - Categorizes assets by role (server > dap > generic)
   - Applies archive type preferences (tgz/tar.gz > zip/vsix)
   - Returns best match or throws descriptive error

## Important Patterns and Conventions

- **Side-effect Free Design**: All functions are pure with no global state modifications
- **Environment Agnostic**: Safe fallbacks for non-Node environments  
- **GitHub API Compatibility**: Expects standard GitHub release asset format with download URLs
- **Hierarchical Preferences**: Multi-level ranking system for asset selection
- **Error Transparency**: Descriptive errors include available options for debugging
- **Type Safety**: Clear union return types differentiate operational modes