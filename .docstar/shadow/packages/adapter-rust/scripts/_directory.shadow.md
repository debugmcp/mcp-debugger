# packages/adapter-rust/scripts/
@generated: 2026-02-09T18:16:10Z

## CodeLLDB Debugger Binary Management Scripts

This directory contains build tooling for managing CodeLLDB debugger dependencies in the Rust adapter package. The primary responsibility is to download, cache, and vendor platform-specific debugger binaries from upstream releases for distribution with the adapter.

### Overall Purpose

The scripts in this directory solve the problem of distributing native debugger binaries across multiple platforms without bloating the package repository. They implement a sophisticated vendoring system that:

- Downloads CodeLLDB debugger binaries from GitHub releases on-demand
- Manages local caching to avoid repeated downloads during development
- Handles cross-platform binary extraction and organization
- Validates binary integrity through checksums and format verification
- Provides CI/CD integration for automated dependency management

### Key Components

**vendor-codelldb.js** - The primary vendoring script that orchestrates the entire binary management workflow:

- **Platform Detection & Selection**: Automatically detects target platforms or processes explicit platform lists for cross-compilation scenarios
- **Download Management**: HTTP client with retry logic, progress tracking, and exponential backoff for reliable artifact retrieval
- **Caching Layer**: Platform-appropriate cache directories with SHA256-based validation to minimize redundant downloads
- **Binary Extraction**: VSIX (ZIP) file processing to extract debugger runtime components
- **Vendor Organization**: Creates structured output directories with proper binary permissions and metadata

### Public API Surface

**Environment Configuration**:
- `CODELLDB_VERSION`: Controls target debugger version (default: '1.11.8')
- `CODELLDB_PLATFORMS`: Override platform selection for cross-compilation
- `CODELLDB_FORCE_REBUILD`: Force fresh downloads bypassing cache
- `SKIP_ADAPTER_VENDOR`: Completely disable vendoring process
- `CODELLDB_VENDOR_LOCAL_ONLY`: Restrict to cached artifacts only

**CLI Usage**: The script can be invoked directly with optional platform arguments or integrated into npm scripts/build processes.

### Internal Organization & Data Flow

1. **Initialization**: Environment parsing, platform determination, and cache directory setup
2. **Validation**: Check for existing vendor artifacts and cache entries
3. **Download Phase**: Retrieve VSIX packages from GitHub releases with caching
4. **Extraction Phase**: Unpack VSIX files and extract debugger binaries/libraries
5. **Organization**: Copy binaries to structured vendor directories with metadata
6. **Verification**: Validate extracted binaries and generate completion reports

### Output Structure

Creates a vendor directory hierarchy:
```
vendor/codelldb/{platform}/
├── adapter/codelldb[.exe]     # Main debugger executable
├── lldb/lib/liblldb.*         # LLDB runtime library
├── lang_support/              # Language-specific helpers
└── version.json               # Version metadata
```

### Integration Patterns

The scripts are designed for integration with:
- **Build Systems**: npm scripts, Rust build.rs files, CI/CD pipelines
- **Development Workflows**: Local caching reduces iteration time
- **Distribution**: Vendor directory structure matches runtime expectations
- **Cross-compilation**: Platform matrix support for building multiple targets

This vendoring system ensures the Rust adapter can reliably access debugger binaries across platforms while maintaining build reproducibility and minimizing network dependencies during development.