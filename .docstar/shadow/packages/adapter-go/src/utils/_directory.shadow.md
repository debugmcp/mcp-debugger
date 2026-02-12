# packages\adapter-go\src\utils/
@generated: 2026-02-12T21:00:53Z

## Overall Purpose
This utilities directory provides essential Go toolchain discovery and validation functionality for the Go adapter. It serves as the foundational layer for locating, verifying, and interfacing with Go and Delve debugger executables across different operating systems.

## Key Components and Integration

### Executable Discovery System
The module implements a sophisticated multi-tiered search strategy for finding Go and Delve executables:
- **Primary Discovery**: `findGoExecutable()` and `findDelveExecutable()` serve as main entry points
- **Search Strategy**: Preferred path → PATH environment → platform-specific common directories
- **Platform Adaptation**: Automatic handling of Windows (.exe) vs Unix executable naming conventions

### Version Management and Validation
Comprehensive version checking capabilities ensure toolchain compatibility:
- **Go Version Detection**: Extracts semantic versions from `go version` command output
- **Delve Version Parsing**: Identifies Delve debugger versions and capabilities
- **DAP Protocol Support**: Validates Debug Adapter Protocol compatibility for debugging features

### Cross-Platform Path Resolution
Intelligent path discovery that adapts to different operating system conventions:
- **Environment Priority**: Respects GOBIN, GOPATH, and other Go-specific environment variables
- **Fallback Locations**: Searches standard installation directories per platform
- **Custom Paths**: Supports user-specified preferred executable locations

## Public API Surface

### Main Entry Points
- `findGoExecutable(preferredPath?, logger?)`: Primary Go executable discovery
- `findDelveExecutable(preferredPath?, logger?)`: Delve debugger executable location
- `getGoVersion(goPath)`: Go toolchain version extraction
- `getDelveVersion(dlvPath)`: Delve debugger version detection
- `checkDelveDapSupport(dlvPath)`: DAP protocol capability validation

### Supporting Utilities
- `getGoSearchPaths()`: Platform-specific search path generation
- `getGopathBin()`: Go workspace binary directory resolution
- `fileExists(filePath)`: Executable permission-aware file existence checking

## Internal Organization and Data Flow
The module follows a hierarchical discovery pattern:
1. **User Preferences**: Honor explicitly provided executable paths
2. **Environment Variables**: Check Go-specific environment configuration
3. **PATH Search**: Scan system PATH for standard executable names
4. **Platform Defaults**: Fall back to common installation directories
5. **Validation**: Verify executability and version compatibility

## Important Patterns and Conventions
- **Graceful Error Handling**: Returns null for optional operations, throws meaningful errors for required resources
- **Promise-Based API**: Consistent async/await pattern throughout
- **Optional Logger Integration**: Safe navigation pattern for logging without hard dependencies
- **Environment Variable Precedence**: Respects Go ecosystem conventions (GOBIN > GOPATH > defaults)
- **Cross-Platform Compatibility**: Abstracts OS differences while maintaining platform-specific optimizations

This utility module acts as the foundation for Go adapter functionality, ensuring reliable access to required toolchain components regardless of installation method or platform configuration.