# packages\adapter-go\src/
@generated: 2026-02-12T21:06:03Z

## Overall Purpose and Responsibility

The `packages/adapter-go/src` directory implements a complete Go debugging adapter for the mcp-debugger system. It provides Go-specific debugging capabilities by integrating with Delve (dlv) debugger using native Debug Adapter Protocol (DAP) support. The module serves as a bridge between the mcp-debugger framework and Go development toolchain, enabling seamless debugging of Go applications, tests, executables, and core dumps.

## Key Components and Relationships

### Core Architecture Stack
The directory follows a layered architecture with clear separation of concerns:

**Factory Layer** (`go-adapter-factory.ts`):
- Implements dependency injection pattern through `IAdapterFactory` interface
- Provides environment validation and metadata for Go debugging capabilities
- Validates Go 1.18+ and Delve DAP support before adapter creation
- Returns structured validation results with system details and version information

**Adapter Layer** (`go-debug-adapter.ts`):
- Main debug adapter implementation extending EventEmitter and `IDebugAdapter`
- Manages state transitions: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED
- Uses Delve's native DAP protocol instead of custom protocol translation
- Implements comprehensive caching for executable paths with 60-second TTL
- Handles Go-specific launch configurations and debugging modes

**Utility Layer** (`utils/`):
- Provides essential system discovery and validation utilities
- Implements sophisticated multi-tiered search strategy for Go toolchain executables
- Handles cross-platform differences (Windows .exe suffixes, platform-specific paths)
- Performs version validation and feature detection for Go and Delve

**Entry Point** (`index.ts`):
- Module export interface following mcp-debugger's dynamic adapter loading pattern
- Provides unified access to all components through structured exports

## Public API Surface

### Main Entry Points
- **Default Export**: Adapter configuration object with name 'go' and factory reference for dynamic loading
- **GoDebugAdapter**: Main debug adapter class for direct instantiation
- **GoAdapterFactory**: Factory class implementing environment validation and adapter creation
- **Go Utilities**: Complete utility functions for Go toolchain discovery and validation

### Key Interfaces
- **GoLaunchConfig**: Go-specific launch configuration supporting debug modes ('debug', 'test', 'exec', 'replay', 'core')
- **Validation API**: Environment pre-flight checks with detailed error reporting
- **Metadata API**: Static configuration including language info, file extensions (.go), version requirements

## Internal Organization and Data Flow

### Initialization Flow
1. **Environment Validation**: Factory validates Go 1.18+ and Delve DAP support
2. **Adapter Creation**: Factory creates GoDebugAdapter instances with validated environment
3. **State Management**: Adapter manages lifecycle through well-defined state transitions
4. **DAP Integration**: Direct delegation to Delve's native DAP implementation

### Runtime Architecture
- **Executable Resolution**: Multi-tier search strategy with caching (preferred path → PATH → platform directories)
- **Command Construction**: Builds `dlv dap --listen=host:port` commands for debugging sessions
- **Event Handling**: Maps DAP events to adapter state changes and thread tracking
- **Configuration Transform**: Converts generic debug configs to Go-specific with sensible defaults

## Important Patterns and Conventions

### Design Patterns
- **Factory Pattern**: Encapsulates adapter creation with environment validation
- **Dependency Injection**: External dependencies for flexible testing and configuration
- **Template Method**: Standardized adapter lifecycle implementation
- **Event-Driven Architecture**: State management through EventEmitter pattern
- **Caching Strategy**: TTL-based caching for expensive executable resolution

### Error Handling Strategy
- **Graceful Degradation**: Version checks return null on failure, discovery functions throw descriptive errors
- **User-Friendly Messages**: Translates technical errors to actionable user guidance
- **Environment Diagnostics**: Comprehensive validation with installation instructions for missing dependencies
- **Recoverable vs Non-recoverable**: Clear error classification for appropriate handling

### Platform Considerations
- **Cross-Platform Support**: Handles Windows executable naming (.exe), macOS Homebrew paths, Linux standard directories
- **Environment Integration**: Respects GOPATH, GOBIN, and PATH environment variables
- **Search Path Hierarchy**: Platform-aware executable discovery with fallback strategies

This module provides a complete, production-ready Go debugging solution that seamlessly integrates with the mcp-debugger ecosystem while maintaining Go-specific debugging capabilities and robust error handling across diverse development environments.