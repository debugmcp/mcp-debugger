# src/proxy/dap-proxy-interfaces.ts
@source-hash: e65dcff1d80d9ca6
@generated: 2026-02-10T00:41:55Z

## DAP Proxy Type System & Dependency Abstractions

This file defines the complete type system and dependency abstractions for a Debug Adapter Protocol (DAP) proxy system that enables debugging communication between a parent process and debug adapters. The design emphasizes dependency injection for testability and clean separation of concerns.

### Core Message Protocol (L12-47)
- **ProxyInitPayload (L12-32)**: Complete initialization command including session config, adapter connection details, debug settings, and optional adapter command specification
- **DapCommandPayload (L34-40)**: Wrapper for forwarding DAP commands with request tracking
- **TerminatePayload (L42-45)**: Session termination command
- **ParentCommand (L47)**: Union type for all incoming commands from parent process

### Response Message System (L51-84)
- **ProxyMessage (L51-55)**: Base interface with sessionId and extensible properties
- **StatusMessage (L57-64)**: Process lifecycle events with exit codes and signals
- **DapResponseMessage (L66-73)**: DAP command responses with success tracking and error handling
- **DapEventMessage (L75-79)**: Debug events forwarded from adapter
- **ErrorMessage (L81-84)**: System error notifications

### Dependency Injection Interfaces (L91-150)
- **ILogger (L91-96)**: Standard logging abstraction with all log levels
- **IFileSystem (L101-104)**: File operations for log directory management
- **IProcessSpawner (L109-111)**: Child process spawning abstraction
- **IDapClient (L116-129)**: Complete DAP client interface matching MinimalDapClient with event handling and lifecycle management
- **IDapClientFactory (L134-136)**: Factory for creating configured DAP clients with policy support
- **IMessageSender (L141-143)**: IPC message transmission abstraction
- **ILoggerFactory (L148-150)**: Async logger creation with session-specific configuration

### Configuration & State Management (L157-205)
- **AdapterConfig (L157-164)**: Debug adapter spawn configuration with environment support
- **AdapterSpawnResult (L169-172)**: Process creation result tracking
- **ProxyState (L179-185)**: State machine enum for proxy lifecycle management
- **TrackedRequest (L190-195)**: Request timeout and timing metadata
- **IRequestTracker (L200-205)**: Request lifecycle management with timeout handling

### Integration Types (L212-249)
- **DapProxyDependencies (L212-218)**: Complete dependency container for worker initialization
- **ExtendedLaunchArgs (L225-234)**: DAP launch arguments with required program field and debug options
- **ExtendedInitializeArgs (L239-249)**: DAP initialize arguments with client identification and capability flags

### Key Dependencies
- `@vscode/debugprotocol`: Standard DAP type definitions
- `@debugmcp/shared`: Shared types for adapter policies and language configs
- `child_process`: Node.js process spawning types

### Architectural Patterns
- Comprehensive dependency injection for all external dependencies
- Event-driven communication with typed message system
- State machine pattern for proxy lifecycle management
- Factory pattern for configurable component creation
- Request tracking with timeout management