# packages\adapter-javascript\scripts\lib/
@generated: 2026-02-12T21:05:43Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/scripts/lib` directory provides core utility functions for managing js-debug dependency acquisition and vendoring strategies. This module serves as the foundational logic layer for JavaScript adapter build scripts, handling asset selection from GitHub releases and determining appropriate vendoring approaches based on environment configuration.

## Key Components and Integration

### Asset Selection Pipeline (`js-debug-helpers.js`)
- **`selectBestAsset(assets)`**: Primary entry point that implements intelligent asset selection from GitHub releases
- **`getArchiveType(name)`**: Internal helper for archive format detection
- **`normalizePath(p)`**: Cross-platform path display utility

### Vendoring Strategy Engine (`vendor-strategy.js`)
- **`determineVendoringPlan(env)`**: Central strategy selector that returns vendoring configuration
- **`parseEnvBool(v)`**: Environment variable parser for boolean flags

The components work together in a typical build workflow where `vendor-strategy.js` determines *how* to obtain js-debug dependencies, while `js-debug-helpers.js` provides the logic for *which* assets to select when fetching from GitHub releases.

## Public API Surface

### Main Entry Points
1. **`selectBestAsset(assets)`** - Selects optimal js-debug asset from GitHub API response
   - Input: Array of GitHub release assets
   - Output: Selected asset object or throws descriptive error
   - Selection priority: server bundles > DAP assets > generic assets
   - Archive preference: tgz/tar.gz over zip/vsix

2. **`determineVendoringPlan(env = process.env)`** - Determines dependency acquisition strategy
   - Input: Environment variables object
   - Output: Strategy object with mode and optional configuration
   - Modes: `'local'` | `'prebuilt-then-source'` | `'prebuilt-only'`

### Supporting Utilities
- **`normalizePath(p)`** - Display-only path normalization (not filesystem-safe)
- **`parseEnvBool(v)`** - Environment variable boolean parsing

## Internal Organization and Data Flow

The module follows a pure functional architecture with clear separation of concerns:

1. **Asset Classification**: GitHub release assets are categorized by role (server/dap/generic) and archive type
2. **Strategy Resolution**: Environment variables are parsed to determine vendoring approach
3. **Preference Algorithms**: Built-in ranking systems for both asset selection and archive type preferences
4. **Error Handling**: Descriptive error messages with context when asset selection fails

## Important Patterns and Conventions

- **Side-Effect Free**: All functions are pure with no global state modification
- **Environment Agnostic**: Safe fallbacks for non-Node.js environments
- **Type Safety**: Clear union types and input validation
- **Extensible Design**: Archive type detection and asset classification easily extended
- **Defensive Programming**: Input validation and graceful handling of malformed data

## Environment Variables

- **`JS_DEBUG_LOCAL_PATH`**: Triggers local development mode with specified path
- **`JS_DEBUG_BUILD_FROM_SOURCE`**: Enables building from source as fallback to prebuilt
- **`JS_DEBUG_FORCE_REBUILD`**: Referenced for external rebuild logic

This library serves as the decision-making core for js-debug dependency management, providing reliable asset selection and strategy determination for the JavaScript adapter build system.