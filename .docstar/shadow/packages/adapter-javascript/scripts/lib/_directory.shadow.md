# packages/adapter-javascript/scripts/lib/
@generated: 2026-02-10T01:19:41Z

## Overall Purpose
The `packages/adapter-javascript/scripts/lib` directory provides core utility functions for managing JavaScript debugging dependencies and assets. This module serves as the foundational library for the adapter's build and vendoring system, handling both asset selection from external sources and determining appropriate vendoring strategies based on environment configuration.

## Key Components and Integration

### Asset Management (`js-debug-helpers.js`)
- **Primary responsibility**: Intelligent selection of optimal js-debug assets from GitHub releases
- **Core capability**: `selectBestAsset()` function that implements sophisticated preference algorithms for choosing between server bundles, DAP assets, and generic packages
- **Asset classification**: Automatically categorizes assets by role (server > dap > generic) and format preference (tgz/tar.gz > zip/vsix)
- **Cross-platform support**: Provides path normalization utilities for display and comparison

### Strategy Determination (`vendor-strategy.js`) 
- **Primary responsibility**: Environment-driven vendoring strategy selection
- **Core capability**: `determineVendoringPlan()` function that analyzes environment variables to determine how dependencies should be acquired
- **Strategy modes**: Local development paths, prebuilt-then-source fallback, or prebuilt-only approaches
- **Configuration parsing**: Robust boolean environment variable parsing with safe defaults

## Public API Surface

### Main Entry Points
1. **`selectBestAsset(assets)`** - Primary asset selection interface
   - Input: GitHub API release assets array
   - Output: Optimal asset object with download information
   - Throws: Descriptive errors when no suitable assets found

2. **`determineVendoringPlan(env?)`** - Strategy determination interface
   - Input: Optional environment object (defaults to process.env)
   - Output: Vendoring plan object with mode and configuration
   - Modes: `'local'`, `'prebuilt-then-source'`, `'prebuilt-only'`

### Supporting Utilities
- **`normalizePath(p)`** - Cross-platform path display normalization
- **`parseEnvBool(v)`** - Environment variable boolean parsing

## Internal Organization and Data Flow

```
Environment Variables → vendor-strategy.js → Vendoring Plan
                                ↓
GitHub Release Assets → js-debug-helpers.js → Selected Asset
                                ↓
            Combined strategy guides asset acquisition
```

The directory implements a two-stage decision process:
1. **Strategy Phase**: Environment analysis determines *how* to acquire dependencies
2. **Selection Phase**: Asset analysis determines *which* specific artifacts to use

## Important Patterns and Conventions

### Design Principles
- **Pure functions**: All utilities are side-effect free for reliable unit testing
- **Error transparency**: Descriptive error messages include context (available options, env vars)
- **Environment safety**: Graceful handling of missing environment variables and non-Node contexts
- **Type safety**: Clear return type unions for different operational modes

### Cross-Platform Considerations
- Path handling designed for display/comparison only (not filesystem operations)
- VSIX files treated as zip containers for extraction compatibility
- Safe fallbacks for undefined environment variables

### Integration Points
- Designed to work with GitHub API asset format expectations
- Environment variable naming follows `JS_DEBUG_*` convention
- Asset selection prioritizes compilation artifacts over source distributions