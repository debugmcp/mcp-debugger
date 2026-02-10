# packages/adapter-javascript/scripts/lib/js-debug-helpers.js
@source-hash: a39d0c8093c72bdb
@generated: 2026-02-09T18:13:53Z

**Primary Purpose**: Pure ESM utility module for GitHub asset selection and cross-platform path normalization, specifically targeting js-debug release artifacts for JavaScript debugging infrastructure.

**Key Functions**:

- `normalizePath(p)` (L15-17): Converts backslashes to forward slashes for display/comparison only. Explicitly not for filesystem operations - returns empty string for non-string inputs.

- `getArchiveType(name)` (L24-30): Internal helper determining archive format from filename. Returns 'tgz' for .tgz/.tar.gz, 'zip' for .zip/.vsix (treats VSIX as zip container), or null for unsupported formats.

- `selectBestAsset(assets)` (L43-103): Core asset selection logic with sophisticated prioritization strategy. Accepts GitHub release asset objects with name/URL properties. Returns object with url, name, and type fields.

**Asset Selection Strategy** (L43-103):
1. **Primary patterns**: Matches `js-debug-(server|dap).*\.(tar\.gz|tgz|zip|vsix)$` 
2. **Fallback patterns**: Matches `js-debug.*\.(tar\.gz|tgz|zip|vsix)$`
3. **Precedence order**: server assets → dap assets → generic assets
4. **Format preference**: .tgz/.tar.gz preferred over .zip/.vsix within each category
5. **Error handling**: Throws descriptive error with available asset names if no match found

**Architecture Decisions**:
- Pure functions only - no side effects for testability
- Treats VSIX files as ZIP archives (they are ZIP containers)
- Flexible URL extraction from multiple GitHub API response formats (browser_download_url, download_url, url)
- Defensive programming with null checks and type coercion

**Dependencies**: None - standalone utility module

**Critical Constraints**:
- `normalizePath` must not be used for actual filesystem operations
- Asset selection requires at least one matching js-debug archive pattern
- Input assets must have valid name and URL properties