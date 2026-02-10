# packages/adapter-go/src/
@generated: 2026-02-10T21:26:48Z

## Overall Purpose
This directory implements a comprehensive Go debug adapter for the mcp-debugger system, providing Go-specific debugging capabilities through integration with the Delve debugger (dlv) and native Debug Adapter Protocol (DAP) support. The module serves as a bridge between the mcp-debugger framework and Go's debugging ecosystem, enabling source-level debugging of Go applications.

## Key Components and Architecture

### Core Components
- **`index.ts`**: Entry point that exposes the adapter for dynamic loading by mcp-debugger's runtime discovery system
- **`go-debug-adapter.ts`**: Main adapter implementation extending EventEmitter with full DAP protocol support and Go-specific debugging features
- **`go-adapter-factory.ts`**: Factory implementation providing dependency injection, environment validation, and metadata for Go debugging capabilities
- **`utils/`**: Infrastructure module handling Go toolchain discovery, validation, and cross-platform executable resolution

### Component Integration
The components follow a layered architecture:

1. **Discovery Layer** (`utils/`): Handles Go/Delve executable discovery across platforms with fallback strategies
2. **Factory Layer** (`go-adapter-factory.ts`): Validates environment prerequisites and creates adapter instances
3. **Adapter Layer** (`go-debug-adapter.ts`): Implements core debugging logic with DAP protocol delegation
4. **Export Layer** (`index.ts`): Provides standardized interface for dynamic loading

### Data Flow
```
mcp-debugger → index.ts → GoAdapterFactory → environment validation → GoDebugAdapter → Delve DAP
```

## Public API Surface

### Main Entry Points
- **Default Export**: Adapter configuration object with name 'go' and factory reference for dynamic loading
- **`GoDebugAdapter`**: Main debug adapter class implementing `IDebugAdapter` interface
- **`GoAdapterFactory`**: Factory implementing `IAdapterFactory` with creation, validation, and metadata methods
- **Go Utilities**: Complete set of executable discovery and version validation functions

### Key Interfaces
- **`GoLaunchConfig`**: Go-specific launch configuration supporting debug modes ('debug', 'test', 'exec', 'replay', 'core')
- **Adapter States**: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED lifecycle
- **Validation Results**: Structured environment validation with errors, warnings, and system metadata

## Internal Organization

### State Management
The adapter implements comprehensive state tracking with event emission, managing the complete debugging lifecycle from initialization through disconnection. Caching mechanisms (60-second TTL) optimize executable path resolution.

### Protocol Handling
Uses Delve's native DAP support via `dlv dap` command rather than custom protocol translation, providing direct DAP event mapping to adapter state transitions and thread tracking.

### Environment Integration
- **Version Requirements**: Go 1.18+ and Delve with DAP support
- **Cross-Platform Support**: Windows executable handling, platform-specific search paths
- **Configuration Defaults**: Optimized settings (stopOnEntry: false, stackTraceDepth: 50, hideSystemGoroutines: true)

## Important Patterns

### Factory Pattern
Encapsulates adapter creation with dependency injection, enabling testability and configuration flexibility.

### Discovery Strategy
Multi-tiered executable resolution: user preferences → environment variables → platform defaults, with comprehensive fallback mechanisms.

### Event-Driven Architecture
EventEmitter-based state management with DAP event delegation, enabling reactive debugging session handling.

### Validation Strategy
Pre-flight environment checks with structured error/warning classification, ensuring reliable adapter initialization.

The module provides a robust, production-ready Go debugging solution that seamlessly integrates with the mcp-debugger ecosystem while maintaining Go toolchain compatibility and cross-platform support.