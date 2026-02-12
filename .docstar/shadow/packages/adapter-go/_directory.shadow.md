# packages\adapter-go/
@generated: 2026-02-12T21:06:17Z

## Overall Purpose and Responsibility

The `packages/adapter-go` directory implements a complete Go debugging adapter for the mcp-debugger system. This module serves as a specialized bridge between the mcp-debugger framework and Go's development toolchain, providing seamless debugging capabilities for Go applications, tests, executables, and core dumps through integration with the Delve debugger's native Debug Adapter Protocol (DAP) support.

## Key Components and Architecture

The directory follows a clean layered architecture with clear separation of concerns:

### Core Architecture Stack
- **Factory Layer**: Implements dependency injection pattern with environment validation, ensuring Go 1.18+ and Delve DAP support before adapter creation
- **Adapter Layer**: Main debug adapter implementation managing state transitions and delegating to Delve's native DAP protocol
- **Utility Layer**: Provides sophisticated Go toolchain discovery with multi-tiered search strategies and cross-platform support
- **Entry Point**: Unified module exports following mcp-debugger's dynamic adapter loading pattern

### Component Relationships
The components work together through a well-defined initialization flow:
1. Factory validates the Go environment and toolchain availability
2. Upon validation success, creates GoDebugAdapter instances
3. Adapter manages debugging lifecycle through state transitions (UNINITIALIZED → READY → DEBUGGING)
4. Utilities provide runtime support for executable resolution and command construction
5. Direct DAP integration eliminates protocol translation overhead

## Public API Surface

### Main Entry Points
- **Default Export**: Adapter configuration object with name 'go' and factory reference for dynamic loading by mcp-debugger
- **GoDebugAdapter**: Main debug adapter class extending EventEmitter and IDebugAdapter interface
- **GoAdapterFactory**: Factory implementing IAdapterFactory with environment validation and metadata provision
- **Utility Functions**: Complete Go toolchain discovery and validation API

### Key Interfaces
- **GoLaunchConfig**: Go-specific launch configuration supporting multiple debug modes ('debug', 'test', 'exec', 'replay', 'core')
- **Validation API**: Pre-flight environment checks with detailed error reporting and system diagnostics
- **Metadata API**: Static configuration including language identification, file extensions (.go), and version requirements

## Internal Organization and Data Flow

### Runtime Architecture
The module implements several sophisticated patterns:
- **Multi-tier Executable Search**: Intelligent discovery across preferred paths, PATH environment, and platform-specific directories
- **TTL-based Caching**: 60-second cache for expensive executable resolution operations
- **Direct DAP Delegation**: Leverages Delve's native DAP implementation instead of custom protocol translation
- **Event-driven State Management**: Comprehensive lifecycle management through EventEmitter pattern

### Cross-Platform Considerations
- Handles Windows executable naming conventions (.exe suffixes)
- Supports macOS Homebrew installation paths
- Respects Linux standard directory structures
- Integrates with GOPATH, GOBIN, and PATH environment variables

## Important Patterns and Conventions

### Design Philosophy
- **Factory Pattern**: Encapsulates complex adapter creation with thorough environment validation
- **Dependency Injection**: Enables flexible testing and configuration management
- **Graceful Degradation**: Provides user-friendly error messages with actionable guidance for missing dependencies
- **Event-driven Architecture**: Clean separation between adapter state management and debugging protocol handling

### Error Handling Strategy
- Clear distinction between recoverable and non-recoverable errors
- Comprehensive environment diagnostics with installation instructions
- Translation of technical errors to user-actionable messages
- Robust validation ensuring reliable debugging session establishment

This module provides a production-ready, Go-specific debugging solution that seamlessly integrates with the mcp-debugger ecosystem while maintaining full compatibility with Go's native debugging capabilities and providing robust cross-platform support.