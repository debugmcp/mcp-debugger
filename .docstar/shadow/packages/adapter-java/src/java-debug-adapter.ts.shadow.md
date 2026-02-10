# packages/adapter-java/src/java-debug-adapter.ts
@source-hash: f60a2d366d45d184
@generated: 2026-02-09T18:14:36Z

## Primary Purpose
Implements a Java Debug Adapter that bridges the Debug Adapter Protocol (DAP) with the Java debugger (jdb), enabling Java debugging through VS Code and other DAP-compatible editors.

## Key Architecture
- **JavaDebugAdapter class (L87-509)**: Main adapter implementation extending EventEmitter and implementing IDebugAdapter
- **Configuration interfaces**: JavaLaunchConfig (L49-60) and JavaAttachConfig (L65-82) for language-specific debug configurations
- **State management**: Tracks adapter state through AdapterState enum transitions
- **Proxy architecture**: Delegates actual DAP communication to external jdb-dap-server.js process

## Core Components

### Lifecycle Management (L103-126)
- `initialize()` (L103-117): Validates Java environment and transitions to READY state
- `dispose()` (L119-126): Cleans up connections and removes event listeners

### Environment Validation (L150-194)
- `validateEnvironment()` (L150-194): Checks Java JDK 8+ availability and jdb presence
- `getRequiredDependencies()` (L196-210): Returns Java JDK and jdb dependency info
- Java version parsing and validation with appropriate error handling

### Configuration Management (L273-351)
- `transformLaunchConfig()` (L273-294): Converts generic launch config to Java-specific format, extracts main class from program path
- `transformAttachConfig()` (L314-342): Handles remote attach configurations with host/port
- Default configurations for both launch and attach scenarios

### Adapter Command Building (L244-261)
- `buildAdapterCommand()` (L244-261): Creates Node.js command to run jdb-dap-server.js (not Java process)
- Passes jdb path, port, and session ID to DAP server

### DAP Protocol Integration (L368-408)
- `handleDapEvent()` (L380-403): Processes DAP events from jdb-dap-server, manages thread tracking and state transitions
- Event forwarding to SessionManager through EventEmitter pattern
- `sendDapRequest()` (L368-378): Delegates to ProxyManager architecture

### Feature Capabilities (L471-509)
- Supports function and exception breakpoints
- **Limitation**: No conditional breakpoints (jdb constraint)
- Exception breakpoint filters for all/uncaught exceptions

## Key Dependencies
- **Java utilities** (L32-38): Java executable discovery, version checking, jdb location
- **@debugmcp/shared** (L11-31): Common debug adapter interfaces and types
- **External DAP server**: Relies on jdb-dap-server.js for actual protocol implementation

## Critical Constraints
- Requires Java JDK 8+ (validated at L161)
- jdb must be available (bundled with JDK)
- Uses proxy architecture - actual DAP communication handled externally
- State transitions must follow: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING

## Implementation Notes
- ES module compatibility setup (L42-44)
- Platform-specific Java installation path detection (L231-237)
- Main class extraction from file paths with .java extension removal
- Error message translation with installation guidance (L450-467)