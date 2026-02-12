# packages\adapter-go/
@generated: 2026-02-12T21:01:27Z

## Overall Purpose and Responsibility

The `packages/adapter-go` directory provides a complete Go debugging adapter implementation for the mcp-debugger system. This module enables comprehensive Go debugging capabilities by integrating with the Delve (dlv) debugger through its native Debug Adapter Protocol (DAP) support. The adapter handles Go-specific debugging requirements, toolchain validation, and cross-platform compatibility while providing a standardized interface for the broader mcp-debugger ecosystem.

## Key Components and Integration

The module implements a layered architecture with clear separation of concerns:

### Core Architecture Layers
- **Entry Point Layer**: Standardized module exports for dynamic loading by mcp-debugger
- **Factory Layer**: Dependency injection, environment validation, and adapter instantiation
- **Adapter Implementation**: Core debugging logic with state management and DAP protocol integration
- **Utility Layer**: Cross-platform toolchain discovery, version validation, and executable resolution

### Component Integration Flow
1. **Environment Discovery**: Factory validates Go 1.18+ and Delve installation using cross-platform utilities
2. **Adapter Creation**: Factory instantiates adapters with validated dependencies and metadata
3. **Debug Session Management**: Adapter manages state transitions and delegates DAP communication to native Delve server
4. **Protocol Integration**: Leverages Delve's native DAP server instead of custom protocol translation

## Public API Surface

### Main Entry Points
- **Default Module Export**: Standard adapter configuration object (`{name: 'go', factory: GoAdapterFactory}`) for seamless integration with mcp-debugger's dynamic loading system
- **GoAdapterFactory**: Primary factory implementing `IAdapterFactory` interface
  - `createAdapter()`: Creates configured Go debug adapter instances
  - `getMetadata()`: Returns Go debugging capabilities and system requirements
  - `validate()`: Comprehensive environment validation with detailed diagnostics
- **GoDebugAdapter**: Core adapter implementing `IDebugAdapter` interface with standard debug lifecycle methods and Go-specific configuration handling

### Supporting APIs
- Go toolchain discovery functions for executable location and validation
- Version checking utilities ensuring compatibility requirements
- Cross-platform path resolution helpers for diverse development environments

## Internal Organization and Data Flow

### State Management Architecture
The adapter implements a comprehensive state machine (UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED) with event-driven transitions and robust error handling throughout the debugging lifecycle.

### Configuration and Command Pipeline
1. **Validation Phase**: Factory ensures Go 1.18+ and Delve DAP support requirements
2. **Configuration Transformation**: Adapter converts generic configs to Go-specific settings with appropriate defaults
3. **Command Construction**: Builds optimized `dlv dap` commands with proper networking configuration
4. **Native DAP Integration**: Delegates protocol handling to Delve's built-in DAP server for optimal performance

### Performance Optimizations
- Intelligent caching of executable paths with 60-second TTL for validation efficiency
- Lazy loading of toolchain discovery for improved startup performance
- Event-driven architecture minimizing polling overhead

## Important Patterns and Conventions

### Design Patterns
- **Factory Pattern**: Encapsulates complex adapter creation and validation logic
- **Delegation Pattern**: Leverages native Delve DAP server capabilities rather than custom protocol implementation
- **Event-Driven Architecture**: State management through EventEmitter pattern for loose coupling
- **Template Method**: Standardized adapter lifecycle with Go-specific customizations

### Go Ecosystem Integration
- **Toolchain Compatibility**: Enforces modern Go version requirements and Delve DAP support
- **Environment Awareness**: Respects Go-specific environment variables (GOBIN, GOPATH) and conventions
- **Debug Mode Flexibility**: Supports various Go debugging scenarios (debug, test, exec, replay, core dumps)
- **Sensible Defaults**: Go-optimized configuration defaults (stopOnEntry: false, hideSystemGoroutines: true)

### Cross-Platform Robustness
- Platform-aware executable discovery with Windows/Unix naming convention handling
- Comprehensive fallback mechanisms for toolchain location across different development environments
- Proper environment variable inheritance and process management for reliable debugging sessions

This module serves as the definitive Go debugging solution within mcp-debugger, providing production-ready toolchain integration, comprehensive error handling, and native DAP protocol support for an optimal Go development debugging experience.