# packages/shared/src/index.ts
@source-hash: aef323086034389d
@generated: 2026-02-09T18:14:43Z

## Purpose and Responsibility

This is the main entry point for the `@debugmcp/shared` package, providing comprehensive type definitions, interfaces, and utilities for the MCP Debugger ecosystem. It enables language-specific debug adapters to integrate seamlessly with the main debugger through standardized contracts and abstractions (L1-9).

## Core Architecture Components

### Debug Adapter System (L11-56)
- **IDebugAdapter interface** and related types (L14-42) - Primary contract for debug adapter implementations
- **AdapterState, DebugFeature enums** (L46-50) - State management and feature flags
- **AdapterError, AdapterErrorCode** (L52-54) - Standardized error handling
- Comprehensive validation, configuration, and capability management types

### Adapter Registry System (L57-90)
- **IAdapterRegistry, IAdapterFactory interfaces** (L58-75) - Registry and factory patterns for adapter management
- **BaseAdapterFactory** (L79-80) - Base implementation for custom factories
- **Type guards and specialized errors** (L83-89) - Runtime type checking and error handling

### External Dependencies Abstraction (L92-112)
- **Core service interfaces** (L94-103) - IFileSystem, IChildProcess, IProcessManager, INetworkManager, IServer, ILogger, etc.
- **Dependency injection contracts** (L105-111) - IDependencies, factory patterns for service creation

### Process Management (L114-131)
- **IProcess, IProcessLauncher interfaces** (L115-130) - Process lifecycle and execution management
- **Debug target and proxy process abstractions** - Specialized process types for debugging scenarios

## Key Models and Data Structures (L133-168)

### Session and Configuration Models (L135-154)
- **Launch/Attach configurations** - CustomLaunchRequestArguments, GenericAttachConfig types
- **Session management** - SessionConfig, DebugSession, DebugSessionInfo types
- **Debug runtime data** - Variable, StackFrame, DebugLocation, Breakpoint types

### Language and State Enums (L157-168)
- **DebugLanguage enum** - Supported programming languages
- **State management enums** - SessionLifecycleState, ExecutionState, SessionState, ProcessIdentifierType
- **State mapping utilities** - mapLegacyState, mapToLegacyState functions for backwards compatibility

## Language-Specific Adapter Policies (L170-188)

### Policy Framework (L172-181)
- **AdapterPolicy interface** (L176) - Strategy pattern for adapter-specific behavior
- **DefaultAdapterPolicy** (L181) - Base implementation

### Language Implementations (L182-188)
- **JsDebugAdapterPolicy** (L182) - JavaScript/Node.js debugging
- **PythonAdapterPolicy** (L183) - Python debugging
- **JavaAdapterPolicy** (L184) - Java debugging  
- **RustAdapterPolicy** (L185-186) - Rust debugging with dedicated interface
- **GoAdapterPolicy** (L187) - Go debugging
- **MockAdapterPolicy** (L188) - Testing/development mock

## Additional Infrastructure (L190-206)

### DAP Client Integration (L190-196)
- **DapClientBehavior interface** - Debug Adapter Protocol client behavior contracts
- **Child session management** - ReverseRequestResult, ChildSessionConfig types

### Utility Systems (L198-206)
- **AdapterLaunchBarrier** (L199) - Coordination for adapter startup
- **FileSystem abstraction** (L202-203) - NodeFileSystem with dependency injection support
- **VSCode Debug Protocol re-export** (L205-206) - Direct access to official DAP types

## Notable Patterns

- **Comprehensive type/value separation** - Types exported separately from enums/classes for optimal tree-shaking
- **Dependency injection architecture** - Extensive use of interfaces for all external dependencies
- **Policy pattern implementation** - Language-specific behavior encapsulated in dedicated policy classes
- **Factory pattern usage** - Consistent factory abstractions for component creation
- **Standardized error handling** - Specialized error classes with detailed categorization