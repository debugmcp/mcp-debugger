# packages/adapter-rust/scripts/vendor-codelldb.js
@source-hash: e7ba81b7090f3007
@generated: 2026-02-09T18:14:41Z

## CodeLLDB Binary Vendoring Script

This Node.js script downloads, extracts, and vendors CodeLLDB debugger binaries from GitHub releases for multiple platforms. It manages a local cache and handles platform-specific extraction of VSIX files containing the debugger runtime.

### Core Functionality

**Main Entry Point**: `main()` (L662-756) orchestrates the entire vendoring process, including environment setup, platform determination, and result reporting.

**Platform Management**: 
- `PLATFORMS` object (L51-82) defines supported platforms (win32-x64, darwin-x64/arm64, linux-x64/arm64) with their VSIX names, binary paths, and target directories
- `getCurrentPlatform()` (L87-98) detects current platform from process.platform/arch
- `determinePlatforms()` (L620-657) resolves which platforms to vendor based on CLI args, env vars, or CI detection

**Download & Extraction**:
- `downloadAndExtract()` (L523-615) main platform processing function with retry logic
- `downloadFile()` (L305-370) handles HTTP downloads with progress bars, timeouts, and exponential backoff
- `extractAndCopyFiles()` (L375-460) extracts VSIX (ZIP) files and copies adapter/lldb binaries to vendor directory
- `copyDirectory()` (L465-482) recursive directory copying with permission preservation

**Caching System**:
- `determineCacheDir()` (L123-152) creates platform-appropriate cache directories
- `loadCacheEntry()` (L168-209) validates cached artifacts with SHA256 checksums
- `saveArtifactToCache()` (L236-269) stores downloads with metadata for future reuse
- `computeSha256()` (L285-300) generates file checksums for cache validation

**Validation & Integrity**:
- `isAlreadyVendored()` (L505-518) checks if correct version already exists
- File magic header validation (L393-396) ensures valid ZIP/VSIX format
- Size verification and checksum validation throughout

### Environment Configuration

Key environment variables (L31-46):
- `CODELLDB_VERSION`: Target version (default: '1.11.8')
- `CI`: CI environment detection for behavior changes
- `SKIP_ADAPTER_VENDOR`: Skip entire process
- `CODELLDB_PLATFORMS`: Override platform selection
- `CODELLDB_FORCE_REBUILD`: Force re-download
- `CODELLDB_VENDOR_LOCAL_ONLY`: Forbid downloads, use existing only

### Output Structure

Creates vendor directory structure:
```
vendor/codelldb/{platform}/
├── adapter/codelldb[.exe]     # Main debugger binary
├── lldb/lib/liblldb.*         # LLDB library
├── lang_support/              # Language helpers
└── version.json               # Metadata
```

### Dependencies

External packages: node-fetch (HTTP), extract-zip (ZIP extraction), progress (UI), crypto (checksums)
Node.js modules: fs/promises, stream, path, os

### Error Handling

Comprehensive retry logic with exponential backoff, cache invalidation on corruption, graceful degradation for unsupported platforms, and CI-specific exit codes for build failures.