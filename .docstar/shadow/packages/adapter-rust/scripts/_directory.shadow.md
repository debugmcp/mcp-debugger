# packages/adapter-rust/scripts/
@generated: 2026-02-10T01:19:40Z

## Overall Purpose and Responsibility

The `packages/adapter-rust/scripts` directory contains automation scripts for setting up and managing dependencies required by the Rust adapter for the MCP debug server. This module handles the complex task of downloading, caching, and organizing cross-platform debugger binaries to enable Rust debugging capabilities across different operating systems and architectures.

## Key Components and Organization

### **vendor-codelldb.js** - Primary Vendoring Script
The sole script in this directory serves as a comprehensive binary dependency manager that:
- Downloads CodeLLDB VSIX packages from GitHub releases for multiple platforms
- Extracts and organizes debugger binaries, LLDB libraries, and language support files
- Implements intelligent caching with SHA256 validation
- Manages cross-platform compatibility for 5 supported targets (Windows x64, macOS x64/ARM64, Linux x64/ARM64)

## Public API Surface

### **Main Entry Point**
- **`node vendor-codelldb.js [platforms...]`** - Primary command-line interface
- Accepts optional platform arguments to override automatic detection
- Returns exit code 0 on success, non-zero on failure

### **Environment Configuration**
The script exposes extensive environment-based configuration:
- **CODELLDB_VERSION**: Target CodeLLDB version (default: '1.11.8')
- **SKIP_ADAPTER_VENDOR**: Bypass entire vendoring process
- **CODELLDB_FORCE_REBUILD**: Force re-download of existing artifacts
- **CODELLDB_VENDOR_LOCAL_ONLY**: Prevent network downloads, use cache only
- **CODELLDB_PLATFORMS**: Override platform detection with comma-separated list
- **CODELLDB_CACHE_DIR**: Custom cache directory location

## Internal Organization and Data Flow

### **Three-Tier Architecture**

1. **Platform Detection & Selection**
   - Maps Node.js platform/arch to internal identifiers
   - Determines target platforms based on environment, CLI args, or defaults
   - Supports CI-specific behavior (vendor all platforms)

2. **Artifact Management**
   - Multi-source download strategy with fallback URLs
   - SHA256-validated caching system with atomic operations
   - Intelligent cache invalidation and cleanup

3. **Binary Organization**
   - Extracts VSIX packages to standardized directory structure
   - Copies platform-specific adapter binaries, LLDB libraries, and language support
   - Sets appropriate file permissions for Unix platforms
   - Creates version manifests for validation

### **Data Flow**
```
Platform Detection → Cache Check → Download (if needed) → Extract → Organize → Validate
```

## Important Patterns and Conventions

### **Error Resilience**
- Exponential backoff retry logic for network operations
- Graceful degradation between CI and local development environments
- Comprehensive error logging with severity levels
- Cache corruption detection and recovery

### **Cross-Platform Compatibility**
- Unified platform abstraction layer
- Platform-specific binary paths and library locations
- Conditional permission setting for executable files
- Standardized vendor directory structure across all platforms

### **Performance Optimization**
- Intelligent caching prevents redundant downloads
- Progress reporting for user feedback (disabled in CI)
- Selective platform vendoring based on context
- Atomic file operations to prevent corruption

## Integration Context

This scripts directory serves as a critical build-time dependency for the Rust adapter package, ensuring that appropriate debugging tools are available for the target platform before the adapter attempts to initialize debugging sessions. The vendored artifacts enable the MCP debug server to provide comprehensive Rust debugging capabilities across diverse development environments.