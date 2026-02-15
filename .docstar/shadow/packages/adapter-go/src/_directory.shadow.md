# packages\adapter-go\src/
@children-hash: 3df5cbd48527cc95
@generated: 2026-02-15T09:01:41Z

## Overall Purpose and Responsibility

The `packages/adapter-go/src` directory implements a complete Go debugging adapter for the mcp-debugger system. It provides Go-specific debugging capabilities through integration with Delve (dlv) debugger using native Debug Adapter Protocol (DAP) support. The module enables debugging Go applications, tests, executables, core dumps, and replay sessions within the broader mcp-debugger framework.

## Key Components and Architecture

The directory follows a layered architecture with clear separation of concerns:

### Core Adapter Layer
- **GoDebugAdapter** - Main adapter implementation extending EventEmitter and IDebugAdapter interface
- **GoAdapterFactory** - Factory pattern implementation for adapter creation with dependency injection
- **GoLaunchConfig** - Go-specific launch configuration supporting multiple debug modes (debug, test, exec, replay, core)

### Utility Infrastructure
- **utils/go-utils** - Cross-platform toolchain discovery, version validation, and executable management
- Provides sophisticated multi-tiered search strategies for Go compiler and Delve debugger location
- Handles platform-specific differences (Windows .exe suffix, macOS Homebrew paths, Linux distributions)

### Integration Layer
- **index.ts** - Package entry point following mcp-debugger's dynamic adapter loading pattern
- Exports all public components and implements required adapter configuration structure

## Public API Surface

### Primary Entry Points
- `GoDebugAdapter` - Main debugging adapter class with full DAP protocol support
- `GoAdapterFactory` - Factory for creating adapter instances with environment validation
- Default export configuration object - Enables dynamic loading by mcp-debugger runtime

### Configuration Interface
- `GoLaunchConfig` - Comprehensive Go debugging configuration with buildFlags, backend selection, goroutine filtering
- Support for Go-specific features like stackTraceDepth, path substitution, and system goroutine hiding

### Utility Functions
- Executable discovery APIs (`findGoExecutable`, `findDelveExecutable`)
- Version detection and compatibility checking
- Cross-platform path resolution and environment integration

## Internal Organization and Data Flow

The module implements a clear request-response flow:

1. **Initialization Phase**: Factory validates Go toolchain (Go 1.18+, Delve with DAP support)
2. **Adapter Creation**: Factory creates GoDebugAdapter instances with validated environment
3. **Configuration Processing**: Adapter transforms generic launch configs to Go-specific configurations
4. **Debug Session Management**: Adapter manages state transitions and DAP protocol communication
5. **Toolchain Integration**: Utils layer provides reliable executable location and version checking

## Critical Patterns and Conventions

### State Management
- Event-driven architecture with comprehensive state tracking (UNINITIALIZED → READY → CONNECTED → DEBUGGING)
- Caching pattern for executable paths with TTL-based expiration (60-second cache)

### Error Handling Strategy
- Distinguishes between blocking errors and warnings during environment validation
- Provides user-friendly error messages with installation instructions
- Graceful degradation for optional toolchain components

### Platform Abstraction
- Single API surface hiding OS-specific implementation details
- Environment variable precedence (GOBIN > GOPATH/bin > system paths)
- Cross-platform executable naming and search path handling

### Integration Patterns
- Dependency injection for adapter dependencies
- Template method pattern for adapter lifecycle management
- Delegation to native Delve DAP protocol instead of custom translation layers

## Key Dependencies and Requirements

- **Runtime Requirements**: Go 1.18+, Delve 0.17.0+ with DAP support
- **Protocol Integration**: Native DAP protocol via `dlv dap` command
- **Framework Integration**: Implements mcp-debugger adapter interfaces and patterns
- **Toolchain Discovery**: Robust cross-platform Go/Delve executable location

This module serves as a complete Go debugging solution within the mcp-debugger ecosystem, providing reliable toolchain integration, comprehensive debugging capabilities, and platform-agnostic operation.