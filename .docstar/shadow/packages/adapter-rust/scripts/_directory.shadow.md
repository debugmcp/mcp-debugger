# packages\adapter-rust\scripts/
@children-hash: c31d884e1fa3a140
@generated: 2026-02-15T09:01:22Z

This directory contains build automation scripts for the Rust adapter package, specifically focused on vendoring external debugging dependencies for cross-platform support.

## Overall Purpose
The scripts directory orchestrates the acquisition and preparation of third-party debugging tools required by the Rust adapter. Its primary responsibility is ensuring that CodeLLDB debugger binaries are available locally across all supported platforms without requiring users to install them separately.

## Key Components

### **vendor-codelldb.js**
The sole script in this directory, serving as a comprehensive vendoring system that:
- Downloads CodeLLDB VSIX packages from GitHub releases
- Extracts platform-specific binaries and libraries
- Organizes them in a standardized vendor directory structure
- Implements robust caching and retry mechanisms
- Provides extensive configuration through environment variables

## Public API Surface
The script serves as a build-time utility with multiple entry points:

**Command Line Interface:**
```bash
node vendor-codelldb.js [platform1] [platform2] ...
```

**Environment Configuration:**
- `CODELLDB_VERSION`: Target version selection
- `SKIP_ADAPTER_VENDOR`: Complete bypass mechanism
- `CODELLDB_FORCE_REBUILD`: Force fresh downloads
- `CODELLDB_VENDOR_LOCAL_ONLY`: Cache-only mode
- `CODELLDB_PLATFORMS`: Platform override
- `CODELLDB_CACHE_DIR`: Custom cache location

## Internal Organization and Data Flow

1. **Platform Detection** → Determines which platforms to vendor (current, specified, or all)
2. **Cache Layer** → SHA256-validated artifact caching with atomic operations
3. **Download Engine** → HTTP client with retry logic, progress tracking, and timeout handling
4. **Extraction Pipeline** → VSIX processing, file copying, and permission management
5. **Vendor Structure** → Standardized directory layout with version manifests

The flow follows a fail-safe pattern: cache first, download on miss, validate integrity, extract atomically.

## Platform Support Matrix
Supports 5 platform targets:
- **Windows**: win32-x64
- **macOS**: darwin-x64, darwin-arm64  
- **Linux**: linux-x64, linux-arm64

Each platform has specific binary paths, library locations, and executable configurations defined in the PLATFORMS mapping.

## Integration Patterns
- **Build Integration**: Called during package preparation and CI workflows
- **Dependency Management**: Creates self-contained vendor tree eliminating runtime dependencies
- **Cross-compilation Support**: Can vendor for platforms different from build host
- **CI Optimization**: Intelligent platform selection (all vs current) based on environment

## Error Handling Strategy
Implements defense-in-depth error handling:
- Network failures → Exponential backoff with multiple retry attempts
- Cache corruption → Automatic invalidation and re-download
- Platform mismatches → Graceful fallbacks and comprehensive logging
- Resource constraints → Progress indication and timeout management

This directory essentially acts as the dependency acquisition layer for the Rust adapter, ensuring that debugging capabilities are consistently available across all deployment scenarios without external tool requirements.