# packages/adapter-go/
@generated: 2026-02-11T23:48:07Z

## Overall Purpose and Responsibility

The `packages/adapter-go` directory provides a complete Go language debugging adapter for the mcp-debugger system. This module enables seamless debugging of Go applications, tests, and executables by integrating Go's native Delve debugger with the MCP debugging infrastructure through the Debug Adapter Protocol (DAP).

## Key Components and Integration

The directory contains a single `src/` subdirectory that implements a layered architecture:

### Core Architecture Stack
- **GoDebugAdapter** - Main adapter implementation managing the complete debugging lifecycle with state-driven transitions and native DAP protocol communication with Delve
- **GoAdapterFactory** - Dependency injection factory providing adapter instantiation, environment validation, and Go-specific metadata management
- **Utils Module** - Cross-platform infrastructure for discovering and validating Go toolchain components (Go compiler and Delve debugger)
- **Index Module** - Standardized entry point for dynamic loading by the mcp-debugger system

### Component Integration Flow
1. **Discovery Phase** - Utils module locates Go toolchain across platforms with caching optimization
2. **Validation Phase** - Factory performs comprehensive environment checks (Go 1.18+, Delve DAP support)
3. **Runtime Phase** - Adapter manages debugging sessions with native Delve DAP communication
4. **Integration Phase** - Index module provides standardized interface for MCP system consumption

## Public API Surface

### Primary Entry Points
- **Default Export** - Adapter configuration object with 'go' identifier for dynamic loading
- **GoDebugAdapter Class** - Core debugging capabilities with full lifecycle management
- **GoAdapterFactory Class** - Factory pattern implementation with validation pipeline
- **Go Utilities** - Complete toolchain discovery and validation toolkit

### Key Capabilities
- Native Delve DAP protocol support (`dlv dap --listen=host:port`)
- Go-specific debug modes ('debug', 'test', 'exec', 'replay', 'core')
- Cross-platform executable discovery with 60-second TTL caching
- Comprehensive pre-flight validation (Go 1.18+, Delve installation, DAP capability)
- State-driven debugging session management with graceful error handling

## Internal Organization and Conventions

The module follows established patterns for adapter integration:

- **Native Protocol Approach** - Leverages Delve's built-in DAP support rather than custom protocol translation
- **Comprehensive Validation Pipeline** - Multi-stage environment verification before debugging sessions
- **Event-Driven State Management** - Clear lifecycle transitions with recoverable error classification
- **Platform Abstraction** - Cross-platform support with Windows-specific handling
- **Dependency Injection** - Factory pattern enables testing and configuration flexibility

## Role in MCP Ecosystem

This directory serves as the specialized Go language adapter within the broader mcp-debugger system. It handles all Go-specific concerns including toolchain discovery, environment validation, configuration transformation, and debugging session management. The adapter integrates seamlessly with the MCP infrastructure through standardized interfaces while providing native Go debugging experiences through Delve's DAP protocol, enabling efficient Go development workflows within the MCP debugging ecosystem.