# packages/adapter-javascript/scripts/lib/
@generated: 2026-02-10T21:26:19Z

## Overall Purpose
The `packages/adapter-javascript/scripts/lib` directory contains core utility libraries for managing js-debug dependency acquisition and deployment strategies. This module provides the foundational logic for determining how to obtain js-debug assets - whether from local development paths, GitHub releases, or source builds - and includes specialized helpers for asset selection and path handling.

## Key Components and Relationships

### Asset Selection Pipeline (`js-debug-helpers.js`)
- **`selectBestAsset(assets)`**: Primary entry point for choosing optimal js-debug assets from GitHub releases
- **`getArchiveType(name)`**: Internal classifier for supported archive formats (tgz, zip, vsix)
- **`normalizePath(p)`**: Cross-platform path display utility (display-only, not filesystem operations)

### Strategy Determination (`vendor-strategy.js`) 
- **`determineVendoringPlan(env)`**: Central decision engine that analyzes environment variables to select vendoring approach
- **`parseEnvBool(v)`**: Environment variable parser for boolean flags

## Public API Surface

**Main Entry Points:**
1. `selectBestAsset(assets)` - Selects best js-debug asset from GitHub API response
2. `determineVendoringPlan(env = process.env)` - Returns vendoring strategy based on environment

**Vendoring Modes:**
- `{ mode: 'local', localPath: string }` - Local development with specified path
- `{ mode: 'prebuilt-then-source' }` - Try prebuilt assets, fallback to source build  
- `{ mode: 'prebuilt-only' }` - Use only prebuilt artifacts (default)

## Internal Organization and Data Flow

The module follows a clear separation of concerns:

1. **Strategy Layer** (`vendor-strategy.js`): Determines *how* to acquire js-debug based on environment
2. **Asset Selection Layer** (`js-debug-helpers.js`): Determines *which* assets to use from available options

**Typical Flow:**
```
Environment Variables → determineVendoringPlan() → Vendoring Strategy
GitHub Release Assets → selectBestAsset() → Optimal Asset Selection  
```

## Important Patterns and Conventions

**Pure Functions**: Both modules are side-effect-free ESM modules designed for unit testing and predictable behavior.

**Asset Prioritization**: Sophisticated ranking system favoring:
- Server assets > DAP assets > Generic assets
- tgz/tar.gz archives > zip/vsix archives
- Pattern matching with primary/fallback regex strategies

**Environment Safety**: Graceful handling of non-Node environments with safe fallbacks and flexible input validation.

**Error Handling**: Descriptive errors with context (available asset names) when selection fails.

**Cross-Platform Compatibility**: Path normalization utilities and archive format detection support diverse deployment scenarios.