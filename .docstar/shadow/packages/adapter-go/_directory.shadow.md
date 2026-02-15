# packages\adapter-go/
@children-hash: 5f3a140913ff822a
@generated: 2026-02-15T09:01:56Z

## Overall Purpose and Responsibility

The `packages/adapter-go` directory implements a comprehensive Go debugging adapter for the mcp-debugger system. This module provides Go-specific debugging capabilities by integrating with the Delve (dlv) debugger using native Debug Adapter Protocol (DAP) support. It enables debugging of Go applications, tests, executables, core dumps, and replay sessions within the broader mcp-debugger framework.

## Key Components and Integration

The directory contains a single `src` subdirectory that implements a complete, production-ready Go debugging solution with the following key components:

### Core Adapter Implementation
- **GoDebugAdapter** - Primary adapter class extending EventEmitter and implementing IDebugAdapter interface
- **GoAdapterFactory** - Factory pattern implementation for adapter creation with comprehensive environment validation
- **GoLaunchConfig** - Go-specific launch configuration supporting multiple debug modes (debug, test, exec, replay, core)

### Utility Infrastructure
- **go-utils** - Cross-platform toolchain discovery and management system
- Sophisticated multi-tiered search strategies for Go compiler and Delve debugger location
- Platform-specific handling (Windows .exe extensions, macOS Homebrew paths, Linux distributions)

### Integration Layer
- **index.ts** - Package entry point implementing mcp-debugger's dynamic adapter loading pattern
- Exports all public components following the framework's adapter configuration structure

## Public API Surface

### Primary Entry Points
- `GoDebugAdapter` - Main debugging adapter with full DAP protocol support and Go-specific state management
- `GoAdapterFactory` - Factory for creating validated adapter instances with Go toolchain requirements (Go 1.18+, Delve 0.17.0+ with DAP)
- Default export configuration object - Enables seamless integration with mcp-debugger's dynamic loading system

### Configuration Interface
- `GoLaunchConfig` - Comprehensive debugging configuration with Go-specific features:
  - Build flags and backend selection
  - Goroutine filtering and system goroutine hiding
  - Stack trace depth control and path substitution
  - Support for all Go debugging scenarios (applications, tests, executables, core dumps)

### Utility APIs
- Cross-platform executable discovery (`findGoExecutable`, `findDelveExecutable`)
- Version detection and compatibility validation
- Environment integration with caching and TTL-based expiration

## Internal Organization and Data Flow

The module implements a robust, event-driven architecture:

1. **Environment Validation** - Factory validates complete Go toolchain availability and compatibility
2. **Adapter Instantiation** - Creates configured GoDebugAdapter instances with validated dependencies
3. **Configuration Processing** - Transforms generic launch configurations to Go-specific parameters
4. **Session Management** - Manages debugging state transitions (UNINITIALIZED → READY → CONNECTED → DEBUGGING)
5. **Protocol Delegation** - Leverages native Delve DAP implementation rather than custom protocol translation

## Important Patterns and Conventions

### Architecture Patterns
- **Factory Pattern** - Centralized adapter creation with dependency injection and validation
- **Event-Driven Architecture** - Comprehensive state tracking with EventEmitter-based communication
- **Delegation Pattern** - Native DAP protocol usage via `dlv dap` command instead of custom implementations

### Error Handling Strategy
- Clear distinction between blocking errors and warnings during environment setup
- User-friendly error messages with specific installation guidance
- Graceful degradation for optional toolchain components

### Platform Abstraction
- Unified API hiding OS-specific implementation complexity
- Environment variable precedence handling (GOBIN > GOPATH/bin > system paths)
- Cross-platform executable discovery with intelligent caching (60-second TTL)

## Key Dependencies and Integration Points

- **Runtime Requirements** - Go 1.18+, Delve 0.17.0+ with DAP support
- **Framework Integration** - Full compliance with mcp-debugger adapter interfaces and lifecycle patterns
- **Protocol Support** - Native DAP protocol integration for maximum compatibility and feature support
- **Toolchain Discovery** - Robust, cached cross-platform Go/Delve executable location

This adapter serves as a complete, production-ready Go debugging solution that seamlessly integrates with the mcp-debugger ecosystem while providing reliable cross-platform operation and comprehensive Go-specific debugging capabilities.