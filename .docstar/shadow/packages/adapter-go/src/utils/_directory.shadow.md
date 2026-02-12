# packages\adapter-go\src\utils/
@generated: 2026-02-12T21:05:44Z

## Overall Purpose
The `utils` directory provides essential system discovery and validation utilities for the Go adapter. It serves as the foundational layer for locating and verifying Go toolchain executables (Go compiler and Delve debugger) across different platforms, ensuring the adapter can properly interface with the Go development environment.

## Key Components and Architecture

### Executable Discovery Engine
The module implements a sophisticated multi-tiered search strategy for finding Go toolchain executables:
- **Primary Discovery Functions**: `findGoExecutable()` and `findDelveExecutable()` serve as the main entry points, orchestrating the search process
- **Search Hierarchy**: Preferred path → PATH environment → platform-specific common installation directories
- **Path Resolution System**: `getGoSearchPaths()` and `getGopathBin()` provide platform-aware search locations

### Version Validation System
Comprehensive version checking capabilities ensure compatibility:
- **Version Extraction**: `getGoVersion()` and `getDelveVersion()` parse tool versions using regex patterns
- **Feature Detection**: `checkDelveDapSupport()` validates DAP protocol availability in Delve
- **Command Execution**: Utilizes `child_process.spawn` for safe tool invocation

### Cross-Platform Abstraction
Handles platform differences transparently:
- **Executable Naming**: Automatic .exe suffix handling on Windows
- **Search Paths**: Platform-specific installation directories (Homebrew on macOS, Program Files on Windows, standard paths on Linux)
- **File System Operations**: Cross-platform file existence and permission checking

## Public API Surface

### Primary Entry Points
- `findGoExecutable(preferredPath?, logger?)` - Locates Go compiler executable
- `findDelveExecutable(preferredPath?, logger?)` - Locates Delve debugger executable
- `getGoVersion(goPath)` - Retrieves Go version information
- `getDelveVersion(dlvPath)` - Retrieves Delve version information
- `checkDelveDapSupport(dlvPath)` - Validates DAP protocol support

### Supporting Utilities
- `getGoSearchPaths()` - Platform-specific search directories
- `getGopathBin()` - Go workspace binary directory resolution
- `fileExists(filePath)` - File existence and executability validation

## Internal Organization and Data Flow

1. **Discovery Request** → Primary discovery functions receive optional preferred paths and logger
2. **Search Strategy** → Multi-tier search: preferred → PATH → platform directories
3. **Validation** → File existence and executable permission checks
4. **Version Verification** → Command execution and regex-based version parsing
5. **Result Delivery** → Return validated executable path or throw descriptive error

## Important Patterns and Conventions

- **Graceful Error Handling**: Version checks return null on failure; discovery functions throw meaningful errors
- **Optional Logging**: Safe navigation pattern for logger interface integration
- **Promise-Based API**: Consistent async/await patterns throughout
- **Environment Precedence**: GOBIN → GOPATH/bin → default fallback hierarchy
- **Platform Detection**: Runtime platform switching for search paths and executable naming

This utility module serves as the critical foundation that enables the Go adapter to reliably locate and interact with Go development tools across diverse system configurations.