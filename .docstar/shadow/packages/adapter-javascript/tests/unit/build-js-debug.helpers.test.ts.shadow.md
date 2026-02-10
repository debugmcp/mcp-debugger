# packages/adapter-javascript/tests/unit/build-js-debug.helpers.test.ts
@source-hash: 3325fa9440439dc9
@generated: 2026-02-09T18:13:57Z

**Purpose**: Unit tests for JavaScript debug build helper functions, specifically testing path normalization and asset selection logic used in build processes.

**Test Dependencies**:
- Vitest testing framework (L1)
- Imports from `../../scripts/lib/js-debug-helpers`: `selectBestAsset`, `normalizePath` (L4)

**Test Suites**:

**normalizePath Tests (L6-15)**:
- Tests cross-platform path normalization functionality
- Verifies backslash-to-forward-slash conversion (L8)
- Tests empty string handling (L10) 
- Tests null input with type assertion override (L11-13)

**selectBestAsset Tests (L17-87)**:
Comprehensive testing of asset selection algorithm with priority rules:

1. **Archive Format Priority** (L18-27): Prefers `.tgz` over `.zip` when both match `dap/server` patterns
2. **Asset Type Priority** (L29-38): Prefers `server` over `dap` regardless of archive format
3. **Single Asset Selection** (L40-46): Handles single asset scenarios
4. **Case Insensitivity** (L48-56): Tests uppercase filenames and `.tar.gz` extension handling
5. **Fallback Logic** (L58-67): Falls back to generic `js-debug-*` patterns when specific variants unavailable
6. **Priority Enforcement** (L69-78): Ensures `dap/server` assets preferred over generic ones
7. **Error Handling** (L80-86): Validates exception throwing with descriptive message when no matching assets found

**Key Behaviors Tested**:
- Asset selection follows hierarchy: `server` > `dap` > generic `js-debug-*`
- Archive format preference: `tgz`/`tar.gz` > `zip`
- Case-insensitive matching
- Robust error handling for edge cases

**Return Object Structure**: Tests expect objects with `name`, `type`, and `url` properties from `selectBestAsset`.