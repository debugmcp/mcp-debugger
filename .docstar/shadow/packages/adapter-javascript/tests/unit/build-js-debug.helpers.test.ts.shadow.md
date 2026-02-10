# packages/adapter-javascript/tests/unit/build-js-debug.helpers.test.ts
@source-hash: 3325fa9440439dc9
@generated: 2026-02-10T00:41:06Z

## Purpose
Unit tests for JavaScript debug helper utilities used in the adapter-javascript package build system. Tests the `normalizePath` and `selectBestAsset` functions from the build scripts.

## Key Test Suites

### normalizePath tests (L6-15)
- **Function**: Cross-platform path normalization utility
- **Test coverage**: Backslash to forward slash conversion (L8), unchanged Unix paths (L9), empty string handling (L10), null input handling with TypeScript override (L11-13)

### selectBestAsset tests (L17-87) 
- **Function**: Asset selection logic for downloading JavaScript debug tools from GitHub releases
- **Priority hierarchy**: server > dap > generic js-debug, tgz/tar.gz > zip
- **Key test scenarios**:
  - Archive format preference: tgz over zip (L18-27)
  - Asset type preference: server over dap (L29-38) 
  - Single asset selection (L40-46)
  - Case-insensitive matching with .tar.gz support (L48-56)
  - Generic js-debug fallback when specific variants unavailable (L58-67)
  - Preference enforcement when multiple types available (L69-78)
  - Error handling for no matching assets (L80-86)

## Dependencies
- **Testing**: vitest framework (L1)
- **Target module**: `../../scripts/lib/js-debug-helpers` (L4)
- **Functions tested**: `selectBestAsset`, `normalizePath` (L4)

## Asset Selection Logic
The `selectBestAsset` function implements a sophisticated selection algorithm for GitHub release assets:
1. Prefers "server" over "dap" variants
2. Within same variant, prefers tgz/tar.gz over zip
3. Falls back to generic "js-debug" prefixed assets
4. Case-insensitive matching
5. Throws descriptive error when no suitable assets found

## Test Data Patterns
Tests use mock GitHub release asset objects with `name` and `browser_download_url` properties, covering various naming conventions and archive formats commonly found in JavaScript tooling releases.