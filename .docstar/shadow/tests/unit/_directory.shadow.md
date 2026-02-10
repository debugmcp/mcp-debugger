# tests/unit/
@generated: 2026-02-10T01:20:15Z

## Overall Purpose
Comprehensive unit test suite for a Debug MCP (Model Context Protocol) Server system that enables debugging capabilities across multiple programming languages. This directory validates the complete architecture from CLI interfaces and transport layers through debug adapter implementations and core debugging protocols.

## System Architecture Under Test
The test suite validates a multi-layered debugging system consisting of:

### Core Infrastructure
- **CLI Layer**: Command-line interface with stdio and SSE (Server-Sent Events) transport modes
- **Dependency Injection Container**: Production dependency wiring and service initialization
- **Debug Adapter System**: Pluggable architecture supporting Python, JavaScript, Rust, Go, C++, and mock adapters
- **Session Management**: Debug session lifecycle, state management, and proxy coordination
- **DAP Protocol Layer**: Debug Adapter Protocol message handling and communication

### Key Subsystems
- **Proxy System**: DAP proxy management with connection pooling, retry logic, and message routing
- **Transport Modes**: Both stdio (traditional CLI) and SSE (HTTP-based streaming) communication
- **Language Adapters**: Specialized debug adapters for different programming languages
- **Shared Infrastructure**: Common utilities, policies, and abstractions across adapters

## Public API Surface & Entry Points

### Primary CLI Interface
- `createCLI()`: Main application factory for command-line interface
- `setupStdioCommand()` / `setupSSECommand()`: Transport mode configuration
- `createDebugMcpServer()`: Core server factory function
- `main()`: Application entry point with CLI initialization

### Debug Session Management
- `DebugMcpServer`: Primary server class orchestrating debug sessions
- `SessionManager`: Session lifecycle and operation coordination  
- `ProxyManager`: DAP proxy process management and communication
- `AdapterRegistry`: Dynamic adapter loading and instance management

### Transport & Communication
- **Stdio Mode**: Direct stdin/stdout for traditional CLI usage
- **SSE Mode**: HTTP endpoints with Express server, CORS support, and WebSocket-like communication
- **DAP Protocol**: Standard Debug Adapter Protocol message handling

## Component Integration & Data Flow

### Initialization Flow
1. **CLI Setup**: Command parsing → logger configuration → transport selection
2. **Dependency Injection**: Service wiring → adapter registration → server factory creation  
3. **Server Startup**: Transport initialization → session management → adapter loading
4. **Debug Session**: Client connection → adapter selection → proxy management → DAP communication

### Message Processing Pipeline
```
Client → Transport Layer → DebugMcpServer → SessionManager → ProxyManager → Language Adapter → Target Process
```

### State Management Pattern
- **Immutable State Operations**: All state updates preserve immutability
- **Event-Driven Architecture**: DAP events drive state transitions and command generation
- **Request Correlation**: Sequence-based request/response matching with timeout management
- **Session Isolation**: Independent session state prevents cross-contamination

## Critical System Behaviors Validated

### Reliability & Error Handling
- **Graceful Degradation**: Continued operation during adapter failures or connection issues
- **Retry Logic**: Exponential backoff for connections and initialization (500ms-8000ms intervals)
- **Timeout Management**: Configurable timeouts with proper cleanup (30s init, 60 attempts for connections)
- **Resource Cleanup**: Proper disposal of processes, connections, and event listeners

### Multi-Language Support
- **Dynamic Loading**: Runtime adapter discovery and loading with fallback strategies
- **Environment Detection**: Python/Node.js/Rust executable resolution and version validation
- **Feature Matrix**: Language-specific capability reporting and requirement validation
- **Container Awareness**: Adapted behavior for containerized deployment environments

### Development & Production Modes
- **Development (stdio)**: Direct CLI usage with immediate feedback
- **Production (SSE)**: HTTP-based deployment with session management and health checks
- **Mock Adapters**: Testing and development support with controllable behavior
- **Container Mode**: Docker/containerized deployment with path resolution and process management

## Testing Architecture & Patterns

### Comprehensive Mocking Strategy
- **Dependency Injection**: All external dependencies mocked for isolation
- **Interface Compliance**: Mock validation ensures implementation consistency
- **Event Simulation**: EventEmitter-based testing for async coordination
- **Environment Control**: Systematic testing of container vs host behaviors

### Coverage Areas
- **Happy Path Validation**: Core functionality works correctly under normal conditions
- **Error Path Testing**: Comprehensive failure scenario coverage with proper error propagation
- **Edge Case Handling**: Boundary conditions, race conditions, and resource constraints
- **Integration Testing**: Component interaction validation across system boundaries

This test suite ensures the Debug MCP Server provides a robust, multi-language debugging platform capable of reliable operation across diverse deployment scenarios while maintaining proper error handling, resource management, and protocol compliance.