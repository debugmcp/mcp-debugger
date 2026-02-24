# packages\adapter-go\src\utils/
@children-hash: fa39c2f42b496611
@generated: 2026-02-24T01:54:49Z

## Purpose

The `utils` directory provides cross-platform system utilities for discovering, validating, and interacting with Go toolchain components (Go compiler and Delve debugger) required by the Go adapter. This module abstracts away platform-specific differences in executable discovery and provides a consistent interface for toolchain validation.

## Key Components

**go-utils.ts** - Core toolchain discovery and validation utilities
- **Discovery Functions**: `findGoExecutable()` and `findDelveExecutable()` implement intelligent search strategies across multiple candidate locations
- **Version Utilities**: `getGoVersion()` and `getDelveVersion()` extract semantic version information from tool outputs  
- **Capability Testing**: `checkDelveDapSupport()` validates Debug Adapter Protocol support for debugging features
- **Path Resolution**: `getGoSearchPaths()` and `getGopathBin()` handle platform-specific installation locations

## Public API Surface

**Main Entry Points:**
- `findGoExecutable(preferredPath?, logger?)` - Primary Go discovery with fallback chain
- `findDelveExecutable(preferredPath?, logger?)` - Delve debugger discovery with DAP support detection
- `getGoVersion(goPath)` - Extract Go semantic version string
- `getDelveVersion(dlvPath)` - Extract Delve version information
- `checkDelveDapSupport(dlvPath)` - Validate debugging protocol support

## Internal Organization

**Search Strategy Hierarchy:**
1. **Preferred Path** - User-specified or adapter-configured paths
2. **PATH Environment** - System-wide executable discovery
3. **Platform Defaults** - OS-specific standard installation locations (C:\Go, /usr/local/go, Homebrew paths)
4. **GOPATH/GOBIN** - Go workspace and binary directories

**Platform Abstraction:**
- Executable name handling (.exe suffix on Windows)
- Path separator differences (Windows vs Unix)
- Installation location conventions per operating system

## Data Flow

The utilities follow a consistent pattern:
1. **Discovery** → Search multiple candidate locations with fallback chain
2. **Validation** → Execute tool with version/help commands to verify functionality
3. **Extraction** → Parse command output for version strings and capability flags
4. **Error Handling** → Graceful degradation returning null/false rather than throwing

## Important Patterns

- **Zero Dependencies**: Pure Node.js built-ins for maximum compatibility
- **Optional Logging**: Accepts logger interface parameter without hard dependency
- **Promise-Based**: Consistent async/await patterns throughout
- **Defensive Programming**: All discovery operations return null on failure rather than throwing
- **Platform Awareness**: Handles Windows/macOS/Linux differences transparently

This utility module serves as the foundation for Go toolchain integration, ensuring the adapter can reliably locate and validate required tools across diverse development environments.