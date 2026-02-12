# packages/adapter-javascript/scripts/lib/
@generated: 2026-02-11T23:47:37Z

## Overall Purpose
The `packages/adapter-javascript/scripts/lib` directory provides a foundational utility library for the JavaScript adapter's build and dependency management system. This module serves as the core decision-making layer for vendoring strategies and asset selection, enabling the adapter to intelligently source and manage js-debug dependencies based on environment configuration and available GitHub releases.

## Key Components and Integration

### Core Modules
- **`vendor-strategy.js`**: Environment-driven strategy selector that determines how js-debug dependencies should be obtained (local development, build from source, or use prebuilt)
- **`js-debug-helpers.js`**: Asset selection and path utilities for choosing optimal js-debug releases from GitHub API responses

### Component Relationship
These modules work in tandem to form a complete dependency resolution pipeline:
1. `vendor-strategy.js` determines *how* to obtain dependencies based on environment variables
2. `js-debug-helpers.js` handles *which* specific assets to select when fetching from external sources
3. Together they enable flexible development workflows from local debugging to production builds

## Public API Surface

### Primary Entry Points
- **`determineVendoringPlan(env?)`**: Main strategy selector returning vendoring mode objects
- **`selectBestAsset(assets)`**: Core asset selection algorithm for GitHub release processing
- **`normalizePath(p)`**: Cross-platform path display utility
- **`parseEnvBool(v)`**: Environment variable boolean parser

### API Design Patterns
All functions are pure, side-effect-free utilities designed for:
- Deterministic unit testing
- Safe concurrent execution  
- Environment-agnostic operation
- Clear separation of concerns

## Internal Organization and Data Flow

### Vendoring Strategy Flow
1. Environment variables (`JS_DEBUG_LOCAL_PATH`, `JS_DEBUG_BUILD_FROM_SOURCE`) drive strategy selection
2. Strategy objects contain mode flags and configuration data
3. Calling scripts use strategy objects to determine execution paths

### Asset Selection Flow
1. GitHub API asset arrays are processed and categorized by type and role
2. Preference algorithms rank assets: server > dap > generic, tgz > zip
3. Best match is selected using sophisticated filtering and ranking logic

## Important Patterns and Conventions

### Error Handling
- Descriptive errors with context (available asset names, strategy conflicts)
- Graceful degradation with sensible defaults
- No throwing on invalid inputs where reasonable defaults exist

### Architecture Principles
- **Pure functions only**: No global state or side effects
- **Environment safety**: Graceful handling of missing `process.env`
- **Type safety**: Clear return type unions and input validation
- **Testability**: Designed for comprehensive unit test coverage

### Domain-Specific Logic
- VSIX files treated as zip archives for extraction compatibility
- GitHub API response format assumptions (name, download URL fields)
- Cross-platform path handling considerations (display vs. filesystem operations)