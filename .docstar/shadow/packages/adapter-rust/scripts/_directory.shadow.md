# packages/adapter-rust/scripts/
@generated: 2026-02-11T23:47:39Z

## Overview
The `packages/adapter-rust/scripts` directory contains build automation scripts for the Rust adapter package of a debug MCP server. This module is responsible for downloading, caching, and organizing external debugging tools to enable cross-platform Rust debugging capabilities.

## Core Responsibility
The primary purpose is to vendor CodeLLDB debugger binaries across multiple platforms (Windows, macOS, Linux on x64/ARM64 architectures) by downloading platform-specific VSIX packages from GitHub releases, extracting the necessary debugging components, and organizing them in a standardized vendor directory structure.

## Key Components

### **vendor-codelldb.js**
The main and only script in this directory, serving as a comprehensive vendoring solution that handles:
- Multi-platform binary distribution management
- HTTP download orchestration with retry logic and caching
- VSIX package extraction and file organization
- Cache management with SHA256 validation
- Environment-based configuration and build control

## Public API Surface

### **Entry Points**
- **CLI Interface**: Direct script execution with platform arguments
- **Environment Variables**: Extensive configuration through environment variables
  - `CODELLDB_VERSION`: Version targeting (default: 1.11.8)
  - `SKIP_ADAPTER_VENDOR`: Complete bypass flag
  - `CODELLDB_FORCE_REBUILD`: Force re-download
  - `CODELLDB_VENDOR_LOCAL_ONLY`: Offline-only mode
  - `CODELLDB_PLATFORMS`: Platform selection override
  - `CODELLDB_CACHE_DIR`: Cache location customization

### **Main Function**
- `main()`: Primary orchestrator with comprehensive error handling and progress reporting

## Internal Organization

### **Data Flow**
1. **Platform Determination** → Selects target platforms based on environment/arguments
2. **Cache Check** → Validates existing artifacts via SHA256 checksums
3. **Download Phase** → Fetches VSIX packages from GitHub with retry logic
4. **Extraction Phase** → Unpacks and organizes debugger components
5. **Validation** → Creates version manifests and sets proper permissions

### **Core Subsystems**
- **Platform Management**: Maps Node.js platform/arch to CodeLLDB targets
- **HTTP Client**: Robust download system with progress tracking and failure handling
- **Cache System**: Persistent artifact storage with integrity validation
- **File Operations**: ZIP extraction, permission setting, and directory organization

## Output Structure
Creates a standardized vendor directory layout:
```
vendor/codelldb/{platform}/
├── adapter/codelldb[.exe]          # Main debugger binary
├── lldb/lib/liblldb.[dll|dylib|so] # LLDB debugging libraries
├── lang_support/                    # Language-specific support files
└── version.json                     # Version tracking manifest
```

## Integration Patterns
- **Build System Integration**: Designed for npm scripts and CI/CD pipelines
- **Cross-Platform Support**: Handles platform-specific binary differences
- **Development Workflow**: Supports local development with cache persistence and offline modes
- **CI Optimization**: Special handling for CI environments with comprehensive platform coverage

## Dependencies
- **extract-zip**: VSIX archive handling
- **node-fetch**: HTTP client for downloads
- **progress**: User-friendly download progress indication
- Core Node.js modules for file system, streaming, and cryptographic operations

This directory serves as the foundation for enabling Rust debugging capabilities across the supported platforms by automating the complex process of acquiring and organizing the necessary debugging tools.