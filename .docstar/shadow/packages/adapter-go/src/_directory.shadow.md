# packages\adapter-go\src/
@generated: 2026-02-12T21:01:13Z

## Overall Purpose and Responsibility

The `packages/adapter-go/src` directory implements a complete Go debugging adapter for the mcp-debugger system. This module provides comprehensive Go debugging capabilities by integrating with Delve (dlv) debugger using native Debug Adapter Protocol (DAP) support. The adapter enables debugging Go applications, tests, and binaries across different platforms while handling Go-specific debugging requirements and configurations.

## Key Components and Integration

### Core Architecture
The module follows a layered architecture with clear separation of concerns:

- **Entry Point** (`index.ts`): Provides standardized module exports and default configuration for dynamic loading by mcp-debugger
- **Factory Layer** (`go-adapter-factory.ts`): Implements dependency injection pattern for adapter creation, environment validation, and metadata provisioning
- **Adapter Implementation** (`go-debug-adapter.ts`): Core debugging logic with state management, DAP protocol handling, and Go-specific configuration
- **Utility Layer** (`utils/`): Cross-platform toolchain discovery, version validation, and executable resolution

### Component Integration Flow
1. **Discovery Phase**: Factory validates Go/Delve installation using utilities for executable discovery and version checking
2. **Instantiation**: Factory creates adapter instances with injected dependencies after successful validation
3. **Initialization**: Adapter performs environment checks and establishes DAP connection with Delve
4. **Debug Session**: Adapter manages state transitions and delegates DAP protocol communication to native Delve DAP server

## Public API Surface

### Main Entry Points
- **Default Export**: Standard adapter configuration object (`{name: 'go', factory: GoAdapterFactory}`) for dynamic loading
- **GoAdapterFactory**: Primary factory class implementing `IAdapterFactory` interface
  - `createAdapter()`: Creates configured Go debug adapter instances
  - `getMetadata()`: Returns Go debugging capabilities and requirements
  - `validate()`: Comprehensive environment validation with detailed diagnostics
- **GoDebugAdapter**: Core adapter class implementing `IDebugAdapter` interface
  - Standard debug lifecycle methods (initialize, launch, attach, disconnect)
  - Go-specific configuration handling and DAP protocol integration

### Exported Utilities
- Go toolchain discovery functions (`findGoExecutable`, `findDelveExecutable`)
- Version validation utilities (`getGoVersion`, `getDelveVersion`, `checkDelveDapSupport`)
- Cross-platform path resolution helpers

## Internal Organization and Data Flow

### State Management
The adapter implements a comprehensive state machine: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING → DISCONNECTED, with event emission for state transitions and error handling.

### Configuration Pipeline
1. **Environment Validation**: Factory validates Go 1.18+ and Delve DAP support requirements
2. **Configuration Transformation**: Adapter converts generic launch configs to Go-specific configurations with appropriate defaults
3. **Command Construction**: Builds `dlv dap` commands with proper listening configuration
4. **DAP Integration**: Delegates protocol handling to native Delve DAP server

### Caching Strategy
Implements intelligent caching for executable paths with 60-second TTL to optimize repeated validations while ensuring freshness for dynamic environments.

## Important Patterns and Conventions

### Design Patterns
- **Factory Pattern**: Encapsulates adapter creation and validation logic
- **Template Method**: Standardized adapter lifecycle with Go-specific implementations
- **Event-Driven Architecture**: State management through EventEmitter pattern
- **Delegation Pattern**: Leverages native Delve DAP server instead of custom protocol translation

### Go Ecosystem Integration
- **Toolchain Compatibility**: Enforces Go 1.18+ and Delve DAP support requirements
- **Environment Respect**: Honors Go-specific environment variables (GOBIN, GOPATH)
- **Debug Mode Support**: Handles various Go debugging scenarios (debug, test, exec, replay, core)
- **Configuration Defaults**: Provides sensible Go-specific defaults (stopOnEntry: false, hideSystemGoroutines: true)

### Cross-Platform Considerations
- **Executable Resolution**: Handles Windows (.exe) vs Unix naming conventions
- **Path Discovery**: Platform-specific search strategies with fallback mechanisms
- **Environment Integration**: Proper environment variable passthrough and process management

This module serves as a complete Go debugging solution within the mcp-debugger ecosystem, providing robust toolchain integration, comprehensive error handling, and native DAP protocol support for optimal Go debugging experience.