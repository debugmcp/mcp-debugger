# packages\adapter-go\src\utils/
@children-hash: bb31b421c5d702d6
@generated: 2026-02-15T09:01:23Z

## Purpose and Responsibility

The `utils` directory provides essential tooling infrastructure for the Go adapter, specifically focused on discovering, validating, and managing Go toolchain executables across different platforms. This module serves as the foundation for locating Go compilers and Delve debuggers required for Go development workflows.

## Core Components

### Executable Discovery Engine
The primary component is a sophisticated executable location system that implements a multi-tiered search strategy:

1. **Preferred Path Resolution** - Respects user-configured executable paths
2. **PATH Environment Search** - Standard system PATH lookup
3. **Platform-Specific Fallbacks** - Common installation directories per OS
4. **Go Ecosystem Integration** - GOPATH/GOBIN environment variable support

### Version Management System
Provides version detection and compatibility checking for discovered executables:
- Go compiler version extraction via `go version` command parsing
- Delve debugger version detection and DAP protocol support validation
- Semantic version regex matching for reliable version identification

### Cross-Platform Path Resolution
Handles platform differences in executable naming, search paths, and installation conventions:
- Windows: `.exe` suffix handling, Program Files paths, user profile directories
- macOS: Homebrew integration, standard Unix paths
- Linux: Standard distribution paths, user-local installations

## Public API Surface

### Main Entry Points
- `findGoExecutable(preferredPath?, logger?)` - Primary Go compiler discovery
- `findDelveExecutable(preferredPath?, logger?)` - Delve debugger location with variant support
- `getGoVersion(goPath)` - Version extraction for Go executables
- `getDelveVersion(dlvPath)` - Version detection for Delve debuggers
- `checkDelveDapSupport(dlvPath)` - DAP protocol compatibility validation

### Supporting Utilities
- `getGoSearchPaths()` - Platform-specific search path generation
- `getGopathBin()` - Go binary directory resolution from environment
- `fileExists(filePath)` - Cross-platform executable validation

## Internal Organization

The module follows a layered architecture:

1. **High-Level Discovery Functions** - User-facing executable location APIs
2. **Version Detection Layer** - Command execution and output parsing
3. **Path Resolution Utilities** - Environment and filesystem interaction
4. **Low-Level Helpers** - File existence and PATH searching

Data flows from user requests through discovery strategies, with fallback chains ensuring robust executable location across diverse development environments.

## Key Patterns and Conventions

- **Graceful Degradation** - Returns null for optional operations, throws errors for required ones
- **Environment Variable Precedence** - Respects GOBIN > GOPATH/bin > default paths
- **Optional Logger Interface** - Safe navigation pattern for debugging output
- **Promise-Based Async API** - Consistent async/await support throughout
- **Platform Abstraction** - Single API surface hiding OS-specific implementation details

This utilities module enables the Go adapter to reliably locate and validate toolchain components regardless of installation method or platform, providing a stable foundation for Go development tooling integration.