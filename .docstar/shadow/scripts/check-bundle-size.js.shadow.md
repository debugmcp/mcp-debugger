# scripts/check-bundle-size.js
@source-hash: 235d3ba0b8152e38
@generated: 2026-02-09T18:15:13Z

## Purpose
Node.js script for monitoring build output size to enforce bundle size constraints and prevent bloated distributions. Specifically targets the `mcp-debugger` package's `cli.mjs` bundle.

## Core Functionality
**checkBundleSize()** (L19-94): Main validation function that:
- Validates existence of `packages/mcp-debugger/dist/cli.mjs` bundle
- Measures file size and converts to MB/KB for reporting
- Applies size thresholds: 8MB warning, 15MB error (L16-17)
- Analyzes bundle composition via optional `bundle-meta.json` metadata
- Validates presence of required adapters (JavaScript, Python, Mock)
- Provides actionable feedback for size violations

## Size Enforcement Logic
- **ERROR_SIZE_MB = 15** (L17): Hard limit triggering exit code 1 with remediation suggestions
- **WARN_SIZE_MB = 8** (L16): Soft limit showing warnings but allowing continuation
- Size calculation: `stats.size / 1024 / 1024` for MB conversion (L37-38)

## Bundle Analysis Features
- **Metadata parsing** (L65-88): Reads `bundle-meta.json` to inspect bundle contents
- **Adapter validation** (L74-87): Ensures critical adapters are bundled:
  - JavaScript adapter (required for npx distribution)
  - Python adapter
  - Mock adapter
- **Input file counting**: Reports total number of bundled files

## Path Resolution
- **ROOT directory**: Resolves to parent of script directory (L13)
- **Target bundle**: `packages/mcp-debugger/dist/cli.mjs` (L20, L30)
- **Metadata file**: `dist/bundle-meta.json` (L65)

## Exit Behavior
- Exit 0: Missing dist/bundle (L26, L33) or success
- Exit 1: Bundle exceeds error threshold (L53) or runtime error (L98)

## Dependencies
- Node.js built-ins: `fs`, `path`, `url` modules (L7-9)
- Requires ES modules support (import statements)