# packages\adapter-rust\scripts/
@generated: 2026-02-12T21:00:56Z

## Purpose and Responsibility

The `packages/adapter-rust/scripts` directory contains vendoring automation for the Rust adapter package, specifically focused on downloading and managing CodeLLDB debugger binaries across multiple platforms. This module enables cross-platform Rust debugging support by automatically provisioning platform-specific LLDB debugger components required for the MCP (Model Context Protocol) debug server.

## Key Components

### **vendor-codelldb.js - Primary Vendoring Script**
The sole component is a comprehensive Node.js automation script that orchestrates the entire CodeLLDB vendoring process. It handles:

- **Platform Detection & Management**: Supports 5 platforms (Windows x64, macOS x64/ARM64, Linux x64/ARM64) with automatic current platform detection
- **Download Management**: Robust HTTP client with retry logic, progress tracking, and caching
- **Artifact Processing**: VSIX package extraction, binary organization, and permission management
- **Cache System**: SHA256-validated caching with atomic operations and invalidation
- **Configuration**: Extensive environment variable support for CI/CD and development workflows

## Public API Surface

### **Main Entry Point**
```bash
node vendor-codelldb.js [platforms...]
```

### **Environment Configuration**
- **CODELLDB_VERSION**: Version targeting (default: '1.11.8')
- **SKIP_ADAPTER_VENDOR**: Complete bypass mechanism
- **CODELLDB_FORCE_REBUILD**: Force re-download
- **CODELLDB_VENDOR_LOCAL_ONLY**: Offline-only mode
- **CODELLDB_PLATFORMS**: Platform override
- **CODELLDB_CACHE_DIR**: Custom cache location

### **Platform Identifiers**
- `win32-x64`, `darwin-x64`, `darwin-arm64`, `linux-x64`, `linux-arm64`

## Internal Organization and Data Flow

### **Processing Pipeline**
1. **Platform Determination**: CLI args → Environment vars → CI detection → Current platform fallback
2. **Cache Check**: Validates existing artifacts against version requirements
3. **Download Phase**: Multi-candidate VSIX retrieval with exponential backoff
4. **Extraction Phase**: VSIX → ZIP → Temp directory → Organized vendor structure
5. **Installation Phase**: Binary copying, permission setting, version manifest creation

### **Directory Structure Output**
```
vendor/codelldb/
├── {platform}/
│   ├── adapter/codelldb[.exe]      # Main debugger adapter
│   ├── lldb/lib/liblldb.*          # LLDB runtime libraries  
│   ├── lang_support/               # Language-specific components
│   └── version.json                # Version tracking
```

### **Error Handling Strategy**
- Network resilience through retry mechanisms and fallbacks
- Cache corruption detection and automatic invalidation  
- Graceful CI/local environment adaptation
- Comprehensive logging with actionable error messages

## Important Patterns and Conventions

### **Platform Abstraction**
Each platform is defined as a configuration object containing VSIX URLs, binary paths, library locations, and target structure - enabling easy addition of new platforms.

### **Atomic Operations**
Cache management and file operations use atomic patterns (temp files + rename) to prevent corruption during interruptions.

### **Environment-Driven Configuration**
Heavy reliance on environment variables enables seamless integration with CI/CD pipelines while maintaining developer-friendly defaults.

### **Progressive Fallback Strategy**
The script attempts multiple sources for each artifact: cached → primary download → alternative candidates, ensuring maximum reliability across network conditions.

This directory serves as a critical infrastructure component, automatically provisioning the native debugging tools required for Rust development workflows within the broader MCP ecosystem.