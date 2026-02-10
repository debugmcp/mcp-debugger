# packages/adapter-java/src/java-debug-adapter.ts
@source-hash: f60a2d366d45d184
@generated: 2026-02-10T00:41:28Z

## Purpose and Responsibility

Java Debug Adapter implementation that bridges the Debug Adapter Protocol (DAP) with Java's jdb (Java Debugger) text-based interface. Provides comprehensive Java debugging capabilities including launch, attach, breakpoints, and exception handling.

## Key Interfaces and Types

- **JavaLaunchConfig** (L49-60): Extends base launch config with Java-specific options (mainClass, classpath, sourcePaths, vmArgs, program)
- **JavaAttachConfig** (L65-82): Extends base attach config for remote debugging with host/port or local PID attachment

## Core Implementation

**JavaDebugAdapter class** (L87-510): Main adapter implementation extending EventEmitter and implementing IDebugAdapter interface.

### Key Properties (L91-96):
- `state`: Current adapter state tracking
- `currentThreadId`: Active debugging thread
- `connected`: Connection status flag
- `javaPath/jdbPath`: Resolved executable paths

### Lifecycle Management (L103-126):
- `initialize()` (L103-117): Validates Java environment and transitions to READY state
- `dispose()` (L119-126): Cleanup with disconnect and listener removal

### Environment Validation (L150-194):
- Validates Java 8+ requirement and jdb availability
- Returns detailed ValidationResult with errors/warnings
- Caches resolved executable paths

### Configuration Transformation (L273-294, L314-341):
- `transformLaunchConfig()`: Converts generic launch to Java-specific config
- `transformAttachConfig()`: Handles both remote (host:port) and local (PID) attach modes
- Extracts main class from program path automatically

### DAP Integration (L368-408):
- `handleDapEvent()`: Processes debugging events and manages state transitions
- Delegates actual DAP requests to ProxyManager
- Tracks thread state and debugging lifecycle

## Architecture Patterns

- **Proxy Architecture**: Uses external jdb-dap-server.js Node.js process rather than direct jdb integration
- **State Machine**: Strict state transitions (UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING)
- **Event-Driven**: Emits state changes and debugging events for external coordination
- **Validation Chain**: Multi-stage environment validation with detailed error reporting

## Dependencies

- Java utilities module (L32-38) for executable discovery and version checking
- @debugmcp/shared types for standard debug adapter interfaces
- VSCode Debug Protocol for DAP compliance

## Critical Constraints

- Requires Java JDK 8+ with jdb debugger
- Limited conditional breakpoint support (jdb limitation, L490)
- Connection management delegated to ProxyManager
- Main class extraction assumes standard Java file naming conventions

## Feature Support

Supports function breakpoints, exception breakpoints, configuration done requests, evaluation for hovers, and terminate requests. Notable limitation: no conditional breakpoints due to jdb constraints.