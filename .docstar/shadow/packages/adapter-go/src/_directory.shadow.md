# packages/adapter-go/src/
@generated: 2026-02-11T23:47:54Z

## Overall Purpose and Responsibility

The `packages/adapter-go/src` directory implements a complete Go debugging adapter for the mcp-debugger system, providing Go language debugging capabilities through Delve (dlv) with native Debug Adapter Protocol (DAP) support. This module bridges Go development workflows with the MCP debugging infrastructure, enabling seamless debugging of Go applications, tests, and executables.

## Key Components and Architecture

### Core Adapter Stack
- **GoDebugAdapter** (`go-debug-adapter.ts`) - Main adapter implementation extending EventEmitter and implementing IDebugAdapter interface. Manages complete debugging lifecycle with state transitions (UNINITIALIZED → READY → CONNECTED → DEBUGGING → DISCONNECTED) and handles DAP protocol communication with Delve.

- **GoAdapterFactory** (`go-adapter-factory.ts`) - Factory implementing dependency injection pattern through IAdapterFactory interface. Provides adapter instantiation, environment validation, and metadata including Go version requirements (1.18+), Delve DAP support verification, and Go-specific configuration.

- **Utils Module** (`utils/`) - Critical infrastructure layer providing cross-platform executable discovery and validation. Implements multi-tiered search strategies for Go compiler and Delve debugger, version validation, and platform-aware path resolution.

### Integration Components
- **Index Module** (`index.ts`) - Entry point providing standardized exports for dynamic loading by mcp-debugger system, including default export configuration for runtime discovery.

## Public API Surface

### Main Entry Points
- **Default Export** - Adapter configuration object with 'go' name and factory for dynamic loading
- **GoDebugAdapter** - Core debugging adapter class with full debugging capabilities
- **GoAdapterFactory** - Factory for creating adapter instances with validation
- **Go Utilities** - Complete executable discovery and validation toolkit

### Key Adapter Methods
- `initialize()` - Environment validation and adapter setup
- `validateEnvironment()` - Go 1.18+ and Delve DAP compatibility checking  
- `buildAdapterCommand()` - Constructs `dlv dap --listen=host:port` commands
- `transformLaunchConfig()` - Go-specific configuration with debug modes ('debug', 'test', 'exec', 'replay', 'core')

### Utility Functions
- `findGoExecutable()` / `findDelveExecutable()` - Cross-platform tool discovery
- `getGoVersion()` / `getDelveVersion()` - Version validation
- `checkDelveDapSupport()` - DAP protocol capability verification

## Internal Organization and Data Flow

The module follows a layered architecture:

1. **Bootstrap Layer** - Utils module discovers and validates Go toolchain executables across platforms
2. **Factory Layer** - GoAdapterFactory performs comprehensive environment validation and creates adapter instances
3. **Adapter Layer** - GoDebugAdapter manages debugging sessions with native Delve DAP communication
4. **Integration Layer** - Index module provides standardized interface for mcp-debugger system

Data flows from executable discovery through environment validation to active debugging sessions, with comprehensive error handling and state management throughout.

## Important Patterns and Conventions

- **Native DAP Protocol** - Uses Delve's built-in DAP support (`dlv dap`) instead of custom protocol translation
- **Comprehensive Validation** - Pre-flight checks for Go 1.18+, Delve installation, and DAP capability
- **State-Driven Architecture** - Event-driven state management with clear lifecycle transitions
- **Caching Strategy** - 60-second TTL caching for executable paths to optimize performance
- **Platform Abstraction** - Cross-platform support with Windows executable suffix handling
- **Graceful Degradation** - Recoverable vs non-recoverable error classification with user-friendly messaging

## Role in Larger System

This directory serves as the complete Go language adapter within the mcp-debugger ecosystem, providing specialized debugging capabilities for Go applications. It integrates with the larger MCP system through standardized interfaces while leveraging Go-specific tooling (Delve) and protocols (DAP) to deliver native debugging experiences. The module handles all Go-specific concerns including executable discovery, environment validation, configuration transformation, and debugging session management, enabling seamless Go development workflows within the MCP debugging infrastructure.