# packages/adapter-go/src/utils/
@generated: 2026-02-10T21:26:17Z

## Purpose
The `utils` directory provides core infrastructure for the Go adapter, specifically handling the discovery, validation, and integration of external Go toolchain components. This module serves as the foundation for locating and verifying Go and Delve debugger executables across different platforms, enabling the adapter to interface with the Go development environment.

## Architecture
The module implements a comprehensive executable discovery system with multiple fallback strategies:

1. **Preferred Path Resolution**: Accepts user-specified executable paths as first priority
2. **Environment-Based Search**: Leverages PATH, GOBIN, and GOPATH environment variables
3. **Platform-Specific Defaults**: Falls back to common installation directories per OS
4. **Version Validation**: Ensures discovered tools meet compatibility requirements

## Key Components

### Primary Discovery Functions
- `findGoExecutable()`: Multi-tiered Go compiler discovery with error handling for missing installations
- `findDelveExecutable()`: Delve debugger location with support for multiple variants (dlv, dlv-dap)
- Both functions follow the same search hierarchy: preferred → environment → platform defaults

### Version Management
- `getGoVersion()` and `getDelveVersion()`: Extract semantic versions from tool output
- `checkDelveDapSupport()`: Validates DAP protocol compatibility for debugging features
- Regex-based parsing ensures reliable version extraction across tool updates

### Path Resolution Utilities
- `getGoSearchPaths()`: Platform-aware search path generation
- `getGopathBin()`: Go workspace binary directory resolution
- `findInPath()` and `fileExists()`: Low-level path and file system utilities

## Public API
The module exposes two main entry points for the Go adapter:
- **`findGoExecutable(preferredPath?, logger?)`**: Locates Go compiler
- **`findDelveExecutable(preferredPath?, logger?)`**: Locates Delve debugger

Both functions accept optional preferred paths and logger instances, returning absolute paths to validated executables or throwing descriptive errors.

## Cross-Platform Support
Handles platform differences through:
- Windows executable suffix handling (.exe)
- OS-specific installation path collections
- Environment variable precedence systems
- File permission validation appropriate to each platform

## Integration Patterns
- Optional logger interface for debugging and user feedback
- Promise-based async API for non-blocking operations
- Graceful error handling with null returns vs exceptions
- Environment variable priority systems respecting Go toolchain conventions

This utilities module abstracts away the complexity of Go toolchain discovery, providing the adapter with reliable access to required development tools regardless of installation method or platform.