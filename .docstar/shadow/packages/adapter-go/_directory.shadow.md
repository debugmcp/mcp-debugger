# packages\adapter-go/
@children-hash: a37bdcadd322a39e
@generated: 2026-02-24T01:55:21Z

## Overview

The `adapter-go` package provides comprehensive Go language debugging support for the MCP debugger system, implementing a complete Debug Adapter Protocol (DAP) bridge to Delve, Go's native debugger. This module enables full-featured debugging of Go applications with breakpoints, variable inspection, stack traces, and goroutine management capabilities.

## Architecture & Component Integration

The package follows a clean factory pattern architecture with three distinct layers:

**Factory Layer**: `GoAdapterFactory` serves as the primary entry point, implementing environment validation (Go 1.18+, Delve with DAP support) and providing controlled adapter instantiation through the `IAdapterFactory` interface.

**Adapter Layer**: `GoDebugAdapter` implements the core `IDebugAdapter` interface, managing the complete debugging lifecycle from configuration transformation through DAP protocol communication with Delve processes.

**Utility Layer**: Cross-platform toolchain discovery utilities abstract platform differences, providing intelligent caching (1-minute TTL) and comprehensive validation for Go and Delve executables across Windows/macOS/Linux environments.

## Key Components & Data Flow

The debugging workflow follows a structured pipeline:

1. **Environment Validation**: Factory validates Go toolchain availability and version compatibility
2. **Configuration Processing**: Adapter transforms generic debug configs into Go-specific Delve parameters
3. **Process Management**: Spawns and manages Delve DAP server processes with full lifecycle control
4. **Protocol Bridging**: Handles bidirectional DAP communication for debugging operations
5. **State Management**: Tracks adapter states (UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING) with event emission

## Public API Surface

**Primary Entry Points**:
- `GoAdapterFactory` - Main factory class for adapter creation with environment validation
- `GoDebugAdapter` - Core adapter implementation with full DAP protocol support
- `findGoExecutable()` & `findDelveExecutable()` - Cross-platform toolchain discovery utilities
- Default export configuration - Enables dynamic loading by MCP debugger framework

**Configuration Interface**:
- `GoLaunchConfig` - Go-specific debug configuration supporting multiple modes (debug, test, exec, replay, core)
- Comprehensive Delve integration with custom flags and build options
- Environment variable and working directory management

**Debugging Capabilities**:
- Full breakpoint management (line, function, conditional breakpoints)
- Variable evaluation and modification with Go-specific type handling
- Stack trace inspection with goroutine awareness
- Step-through debugging (step in/over/out) with concurrent execution support

## Internal Organization & Patterns

**Caching Strategy**: Implements intelligent executable path caching to balance performance with development workflow flexibility, automatically invalidating when tools are updated.

**Error Handling**: Provides contextual error messages with actionable installation instructions, version compatibility guidance, and runtime debugging failure diagnostics.

**Platform Abstraction**: Handles cross-platform differences transparently, supporting standard Go installation patterns and custom GOPATH/GOROOT configurations.

**Dependency Integration**: Seamlessly integrates with the `@debugmcp/shared` package for common debugging utilities while maintaining Go-specific optimizations and extensions.