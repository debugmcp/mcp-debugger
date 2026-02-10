# packages/adapter-java/src/
@generated: 2026-02-10T01:20:07Z

## Overall Purpose and Responsibility

The `packages/adapter-java/src` directory implements a complete Java Debug Adapter for the MCP Debugger ecosystem. It provides Debug Adapter Protocol (DAP) compliant Java debugging capabilities by bridging modern debugging interfaces with Java's command-line `jdb` (Java Debugger) tool. This adapter enables IDE-quality debugging experiences for Java applications through breakpoints, step execution, variable inspection, and exception handling.

## Key Components and Architecture

### Four-Layer Architecture

1. **Public API Layer (`index.ts`)**
   - Barrel export pattern providing single entry point for package consumption
   - Consolidates all public interfaces for external integration
   - Enables clean dependency injection via adapter registry

2. **Adapter Interface Layer (`java-adapter-factory.ts`, `java-debug-adapter.ts`)**
   - `JavaAdapterFactory`: Implements factory pattern for adapter instantiation and environment validation
   - `JavaDebugAdapter`: Main adapter implementation bridging DAP with JDB via proxy architecture
   - Handles configuration transformation, state management, and lifecycle coordination

3. **Protocol Bridge Layer (`jdb-dap-server.ts`)**
   - Standalone Node.js TCP server implementing full DAP specification
   - Manages client connections, message framing, and request/response routing
   - Orchestrates JDB interactions for debugging operations (breakpoints, execution control, introspection)

4. **Java Integration Layer (`utils/`)**
   - Cross-platform Java/JDB executable discovery and validation
   - Process management and command orchestration via `JdbWrapper`
   - Text-to-structured data transformation via `JdbParser`

### Component Integration Flow

```
External Registry → JavaAdapterFactory → JavaDebugAdapter → JDB-DAP Server → JdbWrapper → JDB Process
                                                                        ↓
DAP Client ←→ TCP Server ←→ Command Queue ←→ JdbParser ←→ Raw JDB Output
```

## Public API Surface

### Primary Entry Points

**Factory Interface:**
- `JavaAdapterFactory.createAdapter()`: Main instantiation method
- `JavaAdapterFactory.validate()`: Environment prerequisite validation
- `JavaAdapterFactory.getMetadata()`: Adapter capabilities and requirements

**Adapter Interface:**
- `JavaDebugAdapter.initialize()`: Environment setup and validation
- `JavaDebugAdapter.handleDapEvent()`: DAP protocol event processing
- Configuration transformation methods for launch/attach modes

**Core Debugging Services:**
- Breakpoint management (function, exception breakpoints)
- Execution control (continue, step operations)
- State introspection (threads, stack traces, variables)
- Process lifecycle (launch, attach, terminate)

### Configuration Support

**Launch Configuration (`JavaLaunchConfig`):**
- Main class specification, classpath management
- Source path configuration, JVM arguments
- Automatic main class extraction from program paths

**Attach Configuration (`JavaAttachConfig`):**
- Remote debugging via host:port
- Local process attachment via PID
- Flexible connection parameter handling

## Internal Organization and Data Flow

### State Management
- Strict state machine transitions (UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING)
- Thread-aware debugging with active thread tracking
- Event-driven architecture with comprehensive status reporting

### Process Architecture
- **Proxy Pattern**: Delegates actual debugging to external Node.js server process
- **Command Queuing**: Asynchronous command execution with timeout protection
- **Event Translation**: Maps raw JDB events to structured DAP events

### Cross-Platform Support
- Multi-strategy executable discovery (JAVA_HOME, PATH, explicit paths)
- Platform-specific command resolution with Windows .exe handling
- Comprehensive environment validation with detailed error reporting

## Critical Design Patterns

### Factory and Dependency Injection
- Clean separation between factory (instantiation/validation) and adapter (operation)
- Environment validation occurs at factory level before adapter creation
- Supports dynamic loading by adapter registry systems

### Protocol Abstraction
- Complete DAP implementation hiding JDB complexity from clients
- Standardized error handling and response formatting
- Message framing compliance for IDE integration

### Error Handling and Validation
- Multi-stage validation chain from environment check to runtime operation
- Detailed error context with troubleshooting information
- Graceful degradation and cleanup on failure conditions

### Performance Considerations
- Executable discovery caching to avoid repeated filesystem operations
- Non-blocking command execution for responsive debugging
- Real-time output processing with buffered event detection

This module provides a production-ready Java debugging solution that transforms the text-based JDB interface into a modern, IDE-compatible debugging experience while maintaining reliability and cross-platform compatibility.