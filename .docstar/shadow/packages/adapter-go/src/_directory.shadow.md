# packages/adapter-go/src/
@generated: 2026-02-10T01:19:53Z

## Overall Purpose and Responsibility
The `packages/adapter-go/src` directory implements a complete Go language debug adapter for the mcp-debugger system. This module provides Go-specific debugging capabilities using the Delve debugger (dlv) with native Debug Adapter Protocol (DAP) support, enabling seamless integration with debugger clients for Go applications.

## Key Components and Architecture

### Core Components
- **GoDebugAdapter** (`go-debug-adapter.ts`): Main adapter implementation extending EventEmitter and implementing IDebugAdapter interface. Manages debug session lifecycle, DAP protocol handling, and Go-specific debugging features including goroutine management and source mapping.

- **GoAdapterFactory** (`go-adapter-factory.ts`): Factory implementation following dependency injection pattern. Provides adapter instantiation, metadata provisioning (language info, version requirements), and comprehensive environment validation.

- **Entry Point Module** (`index.ts`): Package entry point exposing all components and providing default export structure for dynamic loading by mcp-debugger system.

- **Utilities Layer** (`utils/`): Foundation infrastructure for Go toolchain discovery, validation, and version checking across platforms.

### Component Relationships
The architecture follows a layered factory pattern:
1. **Factory Layer**: GoAdapterFactory validates environment and creates adapter instances
2. **Adapter Layer**: GoDebugAdapter manages debug sessions and DAP protocol communication
3. **Infrastructure Layer**: Utilities handle toolchain discovery and environment validation
4. **Integration Layer**: Entry point enables dynamic loading and adapter registration

## Public API Surface

### Main Entry Points
- **Default Export**: Adapter configuration object with name 'go' and factory reference for dynamic loading
- **GoDebugAdapter**: Complete debug adapter implementation with lifecycle management
- **GoAdapterFactory**: Factory with `createAdapter()`, `getMetadata()`, and `validate()` methods
- **Go Utilities**: Toolchain discovery functions (`findGoExecutable`, `findDelveExecutable`, version checking)

### Key Interfaces
- **GoLaunchConfig**: Go-specific launch configuration supporting debug modes ('debug', 'test', 'exec', 'replay', 'core') with build flags, backend options, and path substitution
- **IAdapterFactory Implementation**: Standard factory interface for adapter creation and validation
- **IDebugAdapter Implementation**: Core debug adapter interface with state management and DAP protocol handling

## Internal Organization and Data Flow

### Initialization Flow
1. Factory validates Go 1.18+ and Delve DAP support via utilities layer
2. Environment check aggregates errors/warnings and system metadata
3. Adapter creation injects validated dependencies
4. Adapter initializes with state transition to READY

### Debug Session Flow
1. Launch configuration transformation applies Go-specific defaults
2. Delve command construction: `dlv dap --listen=host:port`
3. DAP event delegation maps protocol events to adapter state
4. State management tracks: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED

### Caching Strategy
- Executable path caching with 60-second TTL for performance
- Go workspace integration respecting GOBIN/GOPATH conventions
- Platform-specific path resolution with cross-platform compatibility

## Important Patterns and Conventions

- **Factory Pattern**: Encapsulates adapter creation with dependency injection
- **Event-Driven Architecture**: EventEmitter-based state management with comprehensive lifecycle events
- **Native DAP Integration**: Direct protocol delegation rather than custom translation layer
- **Graceful Error Handling**: Recoverable vs non-recoverable error classification with user-friendly messages
- **Platform Abstraction**: Cross-platform toolchain discovery with Windows/Unix executable handling
- **Environment Respect**: Honors user preferences through environment variables and workspace conventions

## Critical Requirements
- Go 1.18+ compatibility requirement
- Delve debugger with DAP protocol support
- Platform-agnostic design supporting Windows, macOS, and Linux
- Integration with mcp-debugger's dynamic adapter loading system

This directory provides a complete, production-ready Go debugging solution that seamlessly integrates with the larger mcp-debugger ecosystem while maintaining Go-specific debugging capabilities and following established patterns for adapter development.