# packages/adapter-go/
@generated: 2026-02-10T01:20:09Z

## Overall Purpose and Responsibility

The `packages/adapter-go` directory implements a complete Go language debug adapter for the mcp-debugger system. This module provides comprehensive Go-specific debugging capabilities by integrating with the Delve debugger (dlv) and its native Debug Adapter Protocol (DAP) support, enabling seamless debugging experiences for Go applications across multiple platforms.

## Key Components and Integration

The adapter follows a layered architecture with clear separation of concerns:

### Core Architecture Layers
- **Factory Layer**: `GoAdapterFactory` handles environment validation, toolchain discovery, and adapter instantiation using dependency injection patterns
- **Adapter Layer**: `GoDebugAdapter` manages debug session lifecycle, DAP protocol communication, and Go-specific features like goroutine management
- **Infrastructure Layer**: Utilities subsystem (`src/utils/`) provides cross-platform Go toolchain discovery, validation, and version checking
- **Integration Layer**: Entry point module enables dynamic loading and registration with the mcp-debugger system

### Component Interaction Flow
1. Factory validates Go 1.18+ and Delve DAP support through utilities layer
2. Environment validation aggregates system metadata and dependency checks
3. Adapter creation injects validated dependencies and initializes state management
4. Debug sessions leverage native DAP integration for direct protocol communication with Delve

## Public API Surface

### Main Entry Points
- **Default Export**: Adapter configuration object with identifier 'go' and factory reference for mcp-debugger dynamic loading
- **GoDebugAdapter**: Complete debug adapter implementation with EventEmitter-based lifecycle management
- **GoAdapterFactory**: Standard factory interface providing `createAdapter()`, `getMetadata()`, and `validate()` methods
- **Go Utilities**: Toolchain discovery functions (`findGoExecutable`, `findDelveExecutable`) and version validation

### Key Interfaces and Configuration
- **GoLaunchConfig**: Go-specific launch configuration supporting multiple debug modes ('debug', 'test', 'exec', 'replay', 'core') with build flags and path substitution
- **IAdapterFactory**: Standard adapter factory interface for consistent integration patterns
- **IDebugAdapter**: Core debug adapter interface with state management and DAP protocol handling

## Internal Organization and Data Flow

The module implements a sophisticated debug session management system:

### Session Lifecycle Management
- State transitions: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED
- Native DAP integration bypasses custom protocol translation layers
- Event-driven architecture with comprehensive lifecycle event emission

### Environment and Toolchain Integration
- Intelligent caching strategy with 60-second TTL for executable discovery
- Platform-agnostic design supporting Windows, macOS, and Linux
- Respects Go workspace conventions (GOBIN, GOPATH) and user environment preferences
- Graceful error handling with recoverable vs non-recoverable error classification

## Important Patterns and Conventions

- **Native Protocol Integration**: Direct DAP delegation rather than custom protocol adapters
- **Dependency Injection**: Factory pattern encapsulates all external dependencies
- **Cross-Platform Compatibility**: Unified interface across operating systems with platform-specific optimizations
- **Environment Respect**: Honors user toolchain preferences and workspace configurations
- **Performance Optimization**: Strategic caching of toolchain discovery results

## Critical System Requirements

- Go 1.18+ runtime compatibility
- Delve debugger with DAP protocol support
- Integration compatibility with mcp-debugger's dynamic adapter loading system
- Cross-platform executable discovery and process management capabilities

This directory provides a production-ready, feature-complete Go debugging solution that seamlessly integrates with the broader mcp-debugger ecosystem while maintaining Go-specific debugging capabilities and established adapter development patterns.