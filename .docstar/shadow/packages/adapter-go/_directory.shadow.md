# packages/adapter-go/
@generated: 2026-02-10T21:27:08Z

## Overall Purpose and Responsibility

The `packages/adapter-go` module is a specialized debug adapter implementation that provides comprehensive Go debugging capabilities for the mcp-debugger system. This module serves as a bridge between the mcp-debugger framework and Go's debugging ecosystem, specifically integrating with the Delve debugger (dlv) to enable source-level debugging of Go applications through the Debug Adapter Protocol (DAP).

## Key Components and Integration

### Component Architecture
The module follows a layered architecture with clear separation of concerns:

- **Entry Point (`src/index.ts`)**: Exposes the adapter for dynamic loading by mcp-debugger's runtime discovery system
- **Adapter Factory (`src/go-adapter-factory.ts`)**: Handles environment validation, dependency injection, and adapter instance creation with comprehensive Go toolchain verification
- **Core Adapter (`src/go-debug-adapter.ts`)**: Main debugging implementation extending EventEmitter with full DAP protocol support and Go-specific debugging features
- **Utilities (`src/utils/`)**: Infrastructure for Go/Delve executable discovery, validation, and cross-platform resolution with intelligent fallback strategies

### Integration Flow
Components work together in a structured pipeline:
```
mcp-debugger → index.ts → GoAdapterFactory → environment validation → GoDebugAdapter → Delve DAP
```

The factory validates prerequisites (Go 1.18+, Delve with DAP support), creates adapter instances, and provides metadata. The adapter then manages the complete debugging lifecycle through Delve's native DAP support.

## Public API Surface

### Main Entry Points
- **Default Export**: Standardized adapter configuration object with name 'go' and factory reference for seamless dynamic loading
- **GoDebugAdapter**: Primary debug adapter class implementing the `IDebugAdapter` interface with complete DAP protocol support
- **GoAdapterFactory**: Factory implementing `IAdapterFactory` with creation, validation, and metadata capabilities
- **Go Utilities**: Comprehensive executable discovery and version validation functions

### Key Interfaces
- **GoLaunchConfig**: Go-specific launch configuration supporting multiple debug modes ('debug', 'test', 'exec', 'replay', 'core')
- **Adapter Lifecycle**: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED state management
- **Environment Validation**: Structured validation results with errors, warnings, and system metadata

## Internal Organization and Data Flow

### State Management
The adapter implements comprehensive state tracking with event emission, managing the complete debugging lifecycle from initialization through disconnection. Utilizes caching mechanisms (60-second TTL) to optimize executable path resolution and environment validation.

### Protocol Handling
Leverages Delve's native DAP support via `dlv dap` command rather than custom protocol translation, providing direct DAP event mapping to adapter state transitions and efficient thread tracking.

### Cross-Platform Support
- **Environment Requirements**: Go 1.18+ and Delve with DAP support validation
- **Platform Compatibility**: Windows executable handling and platform-specific search paths
- **Configuration Defaults**: Production-optimized settings (stopOnEntry: false, stackTraceDepth: 50, hideSystemGoroutines: true)

## Important Patterns and Conventions

### Factory Pattern with Validation
Encapsulates adapter creation with comprehensive dependency injection and pre-flight environment validation, ensuring reliable initialization and enabling testability.

### Multi-Tiered Discovery Strategy
Implements intelligent executable resolution through user preferences → environment variables → platform defaults, with comprehensive fallback mechanisms for robust toolchain discovery.

### Event-Driven Architecture
EventEmitter-based state management with DAP event delegation enables reactive debugging session handling and seamless integration with the mcp-debugger event system.

### Structured Error Handling
Implements pre-flight validation with structured error/warning classification, providing clear feedback for environment issues and configuration problems.

This module provides a production-ready, robust Go debugging solution that seamlessly integrates with the mcp-debugger ecosystem while maintaining compatibility with Go's toolchain and supporting cross-platform debugging scenarios.