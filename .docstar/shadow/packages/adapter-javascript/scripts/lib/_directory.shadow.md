# packages/adapter-javascript/scripts/lib/
@generated: 2026-02-09T18:16:04Z

## Overview

The `scripts/lib` directory provides core utility modules for the JavaScript adapter's build and vendoring system. This library layer abstracts environment-based decision making and GitHub asset management for debugging infrastructure deployment.

## Key Components

**Vendoring Strategy (`vendor-strategy.js`)**
- Environment variable parsing and boolean coercion utilities
- Strategic determination of dependency sourcing modes based on build context
- Supports three vendoring approaches: local development, build-from-source, and prebuilt artifacts

**Asset Management (`js-debug-helpers.js`)**  
- Cross-platform path normalization for display purposes
- GitHub release asset detection and prioritization logic
- Archive format detection supporting tgz, zip, and vsix containers

## Component Relationships

These modules work together to support the adapter's build pipeline:

1. **Environment Assessment**: `vendor-strategy.js` determines how dependencies should be acquired based on development context
2. **Asset Acquisition**: `js-debug-helpers.js` handles the selection and retrieval of appropriate debugging artifacts from GitHub releases
3. **Path Handling**: Shared utilities ensure cross-platform compatibility during build operations

## Public API Surface

**Main Entry Points:**
- `determineVendoringPlan(env)` - Returns vendoring strategy object based on environment variables
- `selectBestAsset(assets)` - Intelligently selects optimal js-debug artifact from GitHub release assets
- `normalizePath(p)` - Cross-platform path display normalization
- `parseEnvBool(v)` - Environment variable boolean parsing

## Internal Organization

**Data Flow:**
1. Environment variables (`JS_DEBUG_LOCAL_PATH`, `JS_DEBUG_BUILD_FROM_SOURCE`) drive vendoring decisions
2. Asset selection prioritizes server → dap → generic js-debug artifacts with format preferences (tgz > zip)
3. All functions are pure with no side effects, enabling reliable testing and composition

**Design Patterns:**
- **Pure Functions**: All exports are side-effect free for predictable behavior
- **Environment Abstraction**: Safe `process.env` access with fallbacks for non-Node environments  
- **Defensive Programming**: Extensive null checks and type coercion throughout
- **Precedence-Based Logic**: Clear ordering for both vendoring strategies and asset selection

## Critical Constraints

- Path normalization is display-only and must not be used for filesystem operations
- Asset selection requires valid GitHub API response format with name/URL properties
- Vendoring strategy determination requires proper environment variable precedence handling