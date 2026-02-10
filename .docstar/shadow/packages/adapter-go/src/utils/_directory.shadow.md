# packages/adapter-go/src/utils/
@generated: 2026-02-09T18:16:05Z

## Purpose
The `utils` directory provides a comprehensive Go toolchain integration layer for the VS Code Go adapter. It handles the discovery, validation, and capability detection of Go and Delve executables across different platforms, serving as the foundational infrastructure for debugger functionality.

## Key Components

### Executable Management (`go-utils.ts`)
The sole module in this directory implements a complete Go toolchain discovery and management system:

- **Discovery Engine**: Intelligent multi-source search for Go and Delve executables
- **Version Detection**: Capability to extract and validate toolchain versions
- **Platform Abstraction**: Cross-platform executable handling (Windows vs Unix)
- **Environment Integration**: Respects Go ecosystem environment variables (GOPATH, GOBIN)

## Public API Surface

### Primary Entry Points
- **`findGoExecutable()`**: Main Go binary discovery with installation guidance on failure
- **`findDelveExecutable()`**: Delve debugger discovery with setup instructions
- **`getGoVersion()` / `getDelveVersion()`**: Version detection for compatibility checks
- **`checkDelveDapSupport()`**: DAP protocol capability validation

### Supporting Functions
- **`getGoSearchPaths()`**: Platform-aware executable search locations
- **`getGopathBin()`**: Go binary directory resolution
- **`findInPath()` / `fileExists()`**: Low-level discovery utilities

## Internal Organization

### Discovery Strategy
1. **Preferred Path**: User-specified executable locations
2. **PATH Lookup**: Standard environment variable search
3. **Common Locations**: Platform-specific installation directories
4. **Environment Fallbacks**: GOPATH/GOBIN-based discovery

### Data Flow
```
User Request → Discovery Functions → Search Strategy → Version Validation → Capability Check → Ready Executable
```

## Important Patterns

### Architecture Principles
- **Promise-based async**: Non-blocking I/O operations throughout
- **Graceful degradation**: Null returns on failure vs exceptions for utility functions
- **Fail-fast discovery**: Main discovery functions throw with helpful error messages
- **Logging integration**: Optional debug tracing support

### Cross-Platform Compatibility
- Windows executable suffix handling (.exe)
- Platform-specific search paths and environment variables
- Consistent path manipulation across operating systems

## Role in Larger System
This utilities module serves as the critical foundation layer that enables the Go adapter to:
- Locate and validate required Go toolchain components
- Ensure version compatibility before debugging operations
- Provide meaningful error messages for missing tools
- Abstract platform differences from higher-level debugger logic

The module essentially acts as a bridge between the VS Code extension environment and the underlying Go development toolchain, handling all the complexity of cross-platform tool discovery and validation.