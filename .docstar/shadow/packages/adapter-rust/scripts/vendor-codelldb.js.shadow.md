# packages/adapter-rust/scripts/vendor-codelldb.js
@source-hash: e37682a5f04f93f7
@generated: 2026-02-10T01:19:05Z

A Node.js script that downloads and vendors CodeLLDB debugger binaries for multiple platforms from GitHub releases. Part of the Rust adapter package for a debug MCP server.

## Core Purpose
Downloads platform-specific CodeLLDB VSIX packages, extracts binaries and libraries, and organizes them in a vendor directory structure for cross-platform Rust debugging support.

## Environment Configuration (L31-46)
- **CODELLDB_VERSION** (L31): Target version, defaults to '1.11.8'
- **SKIP_ADAPTER_VENDOR** (L35): Bypass entire vendoring process
- **CODELLDB_FORCE_REBUILD** (L33): Force re-download existing artifacts
- **CODELLDB_VENDOR_LOCAL_ONLY** (L41): Forbid downloads, use existing only
- **CODELLDB_PLATFORMS**: Comma-separated platform list override
- **CODELLDB_CACHE_DIR**: Custom cache location

## Platform Support (L51-82)
**PLATFORMS** object defines 5 supported targets:
- win32-x64, darwin-x64, darwin-arm64, linux-x64, linux-arm64
- Each platform specifies VSIX filenames, binary paths, library paths, and target directory structure

## Key Functions

### **getCurrentPlatform()** (L87-98)
Maps Node.js process.platform/arch to internal platform identifiers

### **downloadFile()** (L305-370)
HTTP download with retry logic, progress bars (non-CI), and size validation
- 30-second timeout, exponential backoff on failures
- User-Agent: 'debugmcp/adapter-rust'

### **extractAndCopyFiles()** (L375-460)
Core extraction logic:
1. Validates VSIX ZIP magic header (L393-396)
2. Extracts to temp directory
3. Copies adapter runtime, LLDB libraries, and language support
4. Sets executable permissions on Unix platforms (L418-421)
5. Creates version manifest

### **Cache Management** (L158-269)
- **loadCacheEntry()** (L168-209): SHA256-validated cache retrieval
- **saveArtifactToCache()** (L236-269): Atomic cache storage with metadata
- **invalidateCacheEntry()** (L211-218): Cache cleanup

### **downloadAndExtract()** (L523-615)
Main vendoring orchestrator:
1. Checks if platform already vendored with correct version
2. Tries multiple VSIX candidates per platform
3. Attempts cached artifacts first
4. Falls back to downloads with retry logic

### **determinePlatforms()** (L620-657)
Platform selection priority:
1. CODELLDB_PLATFORMS environment variable
2. CLI arguments
3. All platforms in CI or when VENDOR_ALL=true
4. Current platform only (fallback)

### **main()** (L662-756)
Entry point with comprehensive logging, error handling, and summary reporting

## Dependencies
- **extract-zip**: VSIX extraction
- **node-fetch**: HTTP downloads  
- **progress**: Download progress bars
- Core Node.js modules: fs/promises, stream, crypto

## Directory Structure
```
vendor/codelldb/
├── {platform}/
│   ├── adapter/codelldb[.exe]
│   ├── lldb/lib/liblldb.[dll|dylib|so]
│   ├── lang_support/
│   └── version.json
└── temp/ (cleanup unless CODELLDB_KEEP_TEMP=true)
```

## Error Handling
- Robust retry mechanisms for network failures
- Cache invalidation on corruption
- Graceful degradation in CI vs local environments
- Comprehensive logging with severity levels