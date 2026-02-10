# packages/adapter-go/src/utils/
@generated: 2026-02-10T01:19:37Z

## Overall Purpose
The `utils` directory provides essential tooling discovery and validation functionality for the Go language adapter. It serves as the foundation layer that enables the debugger adapter to locate, verify, and interact with Go toolchain executables (Go compiler and Delve debugger) across different operating systems and installation configurations.

## Key Components and Architecture

### Executable Discovery Engine
The module implements a robust multi-tiered search strategy for locating critical Go development tools:
- **Go Compiler Discovery**: Hierarchical search through preferred paths, PATH environment, and platform-specific installation directories
- **Delve Debugger Discovery**: Extended search including GOPATH/bin locations and support for multiple Delve variants (dlv, dlv-dap)
- **Cross-Platform Support**: Handles Windows executable suffixes (.exe) and platform-specific installation paths

### Version Validation System
Comprehensive version checking and compatibility verification:
- **Go Version Extraction**: Spawns `go version` and parses semantic versioning
- **Delve Version Detection**: Extracts version information from `dlv version` output
- **DAP Protocol Support**: Validates Delve's Debug Adapter Protocol capabilities

### Path Resolution Framework
Intelligent path discovery using environment variable hierarchy:
- **GOBIN/GOPATH Integration**: Respects Go workspace conventions
- **Platform-Specific Defaults**: Includes Homebrew, Windows Program Files, Linux standard paths
- **Environment Variable Precedence**: GOBIN → GOPATH/bin → default locations

## Public API Surface

### Primary Entry Points
- `findGoExecutable(preferredPath?, logger?)`: Main Go compiler discovery function
- `findDelveExecutable(preferredPath?, logger?)`: Primary Delve debugger location function
- `getGoVersion(goPath)`: Go toolchain version verification
- `getDelveVersion(dlvPath)`: Delve debugger version checking
- `checkDelveDapSupport(dlvPath)`: DAP protocol compatibility validation

### Supporting Utilities
- `getGoSearchPaths()`: Platform-aware search path generation
- `getGopathBin()`: Go workspace binary directory resolution
- `fileExists(filePath)`: Executable permission-aware file validation

## Internal Organization and Data Flow

The module follows a layered architecture:
1. **Discovery Layer**: High-level executable location functions that orchestrate search strategies
2. **Path Resolution Layer**: Environment-aware path generation and workspace integration
3. **Validation Layer**: File existence, permission checking, and version verification
4. **Platform Abstraction Layer**: Cross-platform executable naming and path handling

Data flows from discovery requests through path resolution, file system validation, and finally version verification to ensure complete toolchain readiness.

## Important Patterns and Conventions

- **Graceful Degradation**: Version checks return null on failure rather than throwing exceptions
- **Optional Logging**: Consistent logger interface with safe navigation patterns
- **Promise-Based API**: Fully async operations using modern Promise patterns
- **Environment Respect**: Honors user preferences through environment variables and preferred paths
- **Platform Agnostic**: Transparent handling of OS differences in executable discovery

This utility module acts as the critical infrastructure layer that enables the Go adapter to reliably discover and validate the Go development environment across diverse installation scenarios and operating systems.