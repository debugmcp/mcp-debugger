# packages/adapter-javascript/scripts/lib/js-debug-helpers.js
@source-hash: a39d0c8093c72bdb
@generated: 2026-02-10T00:41:07Z

**Purpose**: Pure utility module for selecting optimal js-debug assets from GitHub releases and cross-platform path handling. ESM module designed for side-effect-free unit testing.

**Core Functions**:

- `normalizePath(p)` (L15-17): Converts backslashes to forward slashes for display/comparison only. Returns empty string for non-string inputs. **Critical**: Not for filesystem operations.

- `getArchiveType(name)` (L24-30): Internal helper that extracts archive format from filename. Returns `'tgz'` for `.tgz/.tar.gz`, `'zip'` for `.zip/.vsix` (VSIX treated as zip container), or `null` for unsupported formats.

- `selectBestAsset(assets)` (L43-103): **Main function** that selects optimal js-debug asset from GitHub release assets array. Implements sophisticated preference algorithm:
  1. Primary pattern: `/js-debug-(server|dap).*\.(tar\.gz|tgz|zip|vsix)$/i`
  2. Fallback pattern: `/js-debug.*\.(tar\.gz|tgz|zip|vsix)$/i`
  3. Archive type preference: tgz/tar.gz over zip/vsix
  4. Role-based prioritization: server > dap > generic assets

**Asset Classification** (L50-54, L62-76):
- `serverAssets`: Compiled server bundles (highest priority)
- `dapAssets`: Archives containing `js-debug/src/dapDebugServer.js`  
- `genericAssets`: General js-debug assets (e.g., .vsix files)

**Selection Algorithm** (L82-93):
1. Parse asset names and URLs from GitHub API response format
2. Categorize by role (server/dap) using regex capture groups
3. Rank within categories by archive type preference
4. Return first match from priority order: server → dap → generic

**Error Handling**: Throws descriptive error with available asset names if no suitable match found (L95-100).

**Dependencies**: None - pure functions only.

**Key Constraints**:
- Expects GitHub API asset format with `name`, `browser_download_url`, `download_url`, or `url` fields
- VSIX files treated as zip archives for extraction compatibility
- Path normalization is display-only, not filesystem-safe