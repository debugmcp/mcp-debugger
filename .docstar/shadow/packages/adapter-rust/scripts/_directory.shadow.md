# packages/adapter-rust/scripts/
@generated: 2026-02-10T21:26:20Z

## Overall Purpose

This directory contains build/setup scripts for the Rust adapter package of an MCP (Model Context Protocol) debug server. The primary responsibility is to vendor (download and organize) external debugging tools required for cross-platform Rust development support.

## Key Components

### **vendor-codelldb.js** - Primary Vendoring Script
The core script that manages the download, extraction, and organization of CodeLLDB debugger binaries across multiple platforms. This is essential for providing LLDB-based debugging capabilities for Rust code in various target environments.

## Public API Surface

### Main Entry Point
- **vendor-codelldb.js**: Command-line script invoked during package setup/build
- Supports CLI arguments for platform selection
- Environment variable configuration for build customization

### Environment Configuration
- **CODELLDB_VERSION**: Target debugger version (default: '1.11.8')
- **SKIP_ADAPTER_VENDOR**: Complete bypass mechanism
- **CODELLDB_FORCE_REBUILD**: Force re-download of artifacts
- **CODELLDB_VENDOR_LOCAL_ONLY**: Offline-only mode
- **CODELLDB_PLATFORMS**: Custom platform list override
- **CODELLDB_CACHE_DIR**: Cache location override

## Internal Organization and Data Flow

### 1. Platform Detection & Selection
- Automatic detection of current platform (Node.js process.platform/arch)
- Support for 5 target platforms: Windows x64, macOS x64/ARM64, Linux x64/ARM64
- Flexible platform selection via environment variables or CLI arguments

### 2. Artifact Management Pipeline
```
Platform Selection → Cache Check → Download → Extract → Vendor → Validate
```

### 3. Caching System
- SHA256-validated cache entries for downloaded VSIX packages
- Atomic cache operations with metadata tracking
- Cache invalidation on corruption detection

### 4. Vendor Directory Structure
Organizes extracted debugger components into standardized layout:
```
vendor/codelldb/{platform}/
├── adapter/           # Core debugger executable
├── lldb/lib/          # LLDB runtime libraries
├── lang_support/      # Language-specific support files
└── version.json       # Version manifest
```

## Important Patterns and Conventions

### Robust Download Handling
- HTTP downloads with retry logic and exponential backoff
- Progress indication (except in CI environments)
- User-Agent identification: 'debugmcp/adapter-rust'
- 30-second timeout with comprehensive error handling

### Cross-Platform Considerations
- Platform-specific binary paths and file extensions
- Unix executable permission setting
- ZIP magic header validation for VSIX integrity
- Temporary directory cleanup (configurable via CODELLDB_KEEP_TEMP)

### Build Integration
- CI/local environment detection for behavior adaptation
- Graceful fallback mechanisms when downloads fail
- Comprehensive logging with severity levels
- Summary reporting of vendoring operations

## Role in Larger System

This scripts directory serves as the build-time dependency management layer for the Rust adapter package. It ensures that the necessary debugging infrastructure (CodeLLDB) is available across all supported platforms, enabling the MCP debug server to provide consistent Rust debugging capabilities regardless of the target deployment environment.

The vendored artifacts become part of the distributed package, eliminating runtime download requirements and ensuring offline debugging support.