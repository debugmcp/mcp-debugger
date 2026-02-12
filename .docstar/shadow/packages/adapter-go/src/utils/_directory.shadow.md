# packages/adapter-go/src/utils/
@generated: 2026-02-11T23:47:37Z

## Overall Purpose and Responsibility

The `utils` directory provides essential infrastructure for the Go adapter, specifically focused on discovering and validating Go toolchain executables across different platforms. This module serves as the foundation for the adapter's ability to interact with Go and Delve debugger tools by handling the complex task of locating these executables in various installation scenarios.

## Key Components and Architecture

The directory centers around **go-utils.ts**, which implements a comprehensive executable discovery and validation system with three main subsystems:

1. **Executable Discovery Engine**: Multi-tiered search strategies that prioritize user preferences, then fall back to PATH scanning and platform-specific common installation directories
2. **Version Validation System**: Command-line integration to verify tool versions and capabilities
3. **Cross-Platform Path Resolution**: Platform-aware search paths and executable naming conventions

## Public API Surface

### Primary Entry Points
- `findGoExecutable(preferredPath?, logger?)` - Main Go compiler discovery
- `findDelveExecutable(preferredPath?, logger?)` - Delve debugger discovery with DAP variant support
- `getGoVersion(goPath)` - Go version extraction and validation
- `getDelveVersion(dlvPath)` - Delve version checking
- `checkDelveDapSupport(dlvPath)` - DAP protocol capability verification

### Supporting Utilities
- `getGoSearchPaths()` - Platform-specific installation path discovery
- `getGopathBin()` - Go workspace binary directory resolution
- `fileExists(filePath)` - Executable permission validation

## Internal Organization and Data Flow

The module follows a hierarchical search strategy:

1. **User Preference Layer**: Accepts optional preferred executable paths
2. **Environment Discovery**: Scans PATH and Go-specific environment variables (GOBIN, GOPATH)
3. **Platform Fallbacks**: Searches common installation directories based on OS
4. **Validation Layer**: Confirms executable permissions and functionality

Data flows from high-level discovery functions through platform-specific path generators to low-level file system validation, with consistent error handling and logging throughout.

## Important Patterns and Conventions

- **Graceful Degradation**: Version checks return null on failure rather than throwing, allowing the adapter to function with limited information
- **Platform Abstraction**: Windows executable suffix handling (.exe) with unified API
- **Environment Variable Precedence**: Respects Go ecosystem conventions (GOBIN > GOPATH/bin > defaults)
- **Async-First Design**: Promise-based API with proper error propagation
- **Safe Logging**: Optional logger interface with defensive programming patterns

## Role in Larger System

This utility module serves as the critical bootstrap layer for the Go adapter, enabling all subsequent Go toolchain interactions. It abstracts away platform differences and installation variations, providing a reliable foundation for debugging operations. The adapter depends on this module to establish communication with Go compiler and Delve debugger before any debugging sessions can commence.