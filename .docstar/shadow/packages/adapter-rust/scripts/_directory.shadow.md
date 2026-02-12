# packages\adapter-rust\scripts/
@generated: 2026-02-12T21:05:43Z

## Purpose
The `packages/adapter-rust/scripts` directory contains Node.js automation scripts for setting up the Rust debugging environment. This module handles the complex task of downloading, extracting, and organizing platform-specific debugger binaries to enable cross-platform Rust debugging capabilities in the MCP server.

## Key Components

### **vendor-codelldb.js**
The primary script responsible for downloading and vendoring CodeLLDB debugger binaries from GitHub releases. This is a comprehensive utility that handles:
- Multi-platform binary distribution (Windows, macOS, Linux - x64/ARM64)
- Intelligent caching with SHA256 validation
- Robust download mechanisms with retry logic
- Binary extraction and organization
- Version management and validation

## Public API Surface

### **Main Entry Point**
- `node vendor-codelldb.js [platforms...]` - Downloads and vendors CodeLLDB for specified or detected platforms

### **Environment Configuration**
- **CODELLDB_VERSION**: Target CodeLLDB version (default: 1.11.8)
- **SKIP_ADAPTER_VENDOR**: Bypass entire vendoring process
- **CODELLDB_FORCE_REBUILD**: Force re-download of existing artifacts
- **CODELLDB_VENDOR_LOCAL_ONLY**: Use cache only, forbid downloads
- **CODELLDB_PLATFORMS**: Override platform selection
- **CODELLDB_CACHE_DIR**: Custom cache directory location

## Internal Organization

### **Data Flow**
1. **Platform Detection**: Determines target platforms from CLI args, environment, or auto-detection
2. **Cache Management**: Checks for existing cached artifacts with version validation
3. **Download Orchestration**: Fetches platform-specific VSIX packages from GitHub
4. **Binary Extraction**: Extracts debugger binaries, LLDB libraries, and language support files
5. **Vendor Organization**: Creates structured directory layout for runtime consumption

### **Core Architecture**
- **Platform Abstraction**: Maps Node.js platform identifiers to CodeLLDB VSIX variants
- **Caching Layer**: SHA256-validated artifact storage with atomic operations
- **Download Engine**: HTTP client with exponential backoff, progress reporting, and timeout handling
- **Extraction Pipeline**: ZIP processing with validation, selective file copying, and permission management

## Directory Structure Output
```
vendor/codelldb/
├── {platform}/
│   ├── adapter/codelldb[.exe]     # Main debugger adapter
│   ├── lldb/lib/liblldb.*         # LLDB debugging libraries
│   ├── lang_support/              # Language-specific support files
│   └── version.json               # Version manifest
└── temp/                          # Temporary extraction workspace
```

## Integration Patterns
- **CI/CD Friendly**: Respects CI environment variables and provides appropriate logging levels
- **Cross-Platform**: Handles platform-specific binary formats and file permissions
- **Caching Strategy**: Implements intelligent caching to minimize redundant downloads
- **Error Recovery**: Comprehensive retry mechanisms and graceful degradation
- **Atomic Operations**: Ensures consistent state even during interrupted operations

This module serves as the foundation for Rust debugging capabilities, automatically provisioning the necessary native debugging infrastructure across all supported platforms.