# src\session\session-manager-operations.ts
@source-hash: 86e21304c1feff7d
@generated: 2026-02-23T19:00:06Z

## Debug Session Operations Manager

Core service for orchestrating debug session lifecycle operations including starting, stepping, continuing, breakpoint management, and expression evaluation. Extends `SessionManagerData` to provide high-level debugging operations through DAP (Debug Adapter Protocol) integration.

### Key Operations

**Session Startup & Lifecycle**
- `startDebugging()` (L358-745): Main entry point for launching/attaching debug sessions with comprehensive error handling
- `startProxyManager()` (L50-295): Creates and configures proxy manager with adapter-specific launch configs
- `attachToProcess()` (L1335-1423): Attaches to running processes using DAP attach protocol
- `detachFromProcess()` (L1428-1487): Detaches from processes with optional termination

**Step Operations**
- `stepOver()` (L833-873): Executes DAP 'next' command with event-driven completion
- `stepInto()` (L875-915): Executes DAP 'stepIn' command with location capture
- `stepOut()` (L917-957): Executes DAP 'stepOut' command
- `_executeStepOperation()` (L959-1076): Shared step execution logic with timeout and event handling

**Breakpoint Management**
- `setBreakpoint()` (L748-831): Creates breakpoints with DAP verification and structured logging

**Expression Evaluation**
- `evaluateExpression()` (L1153-1330): Evaluates expressions in debug context with automatic frame detection

**Control Flow**
- `continue()` (L1078-1131): Resumes execution from paused state

### Architecture Integration

**Adapter Registry**: Uses `this.adapterRegistry.create()` to instantiate language-specific debug adapters (L140)

**Proxy Management**: Creates and manages `ProxyManager` instances for DAP communication (L285-292)

**Policy Framework**: Leverages `this.selectPolicy()` for language-specific behaviors like handshake requirements (L482-501)

**State Management**: Updates session state through `_updateSessionState()` and session store persistence (L380-386)

### Error Handling Patterns

**Session Validation**: Consistent checks for terminated sessions using `SessionLifecycleState.TERMINATED` (L757, L837, L879, L921, L1082)

**Proxy Availability**: Validates proxy manager state before operations (L846-848, L888-890, L1091-1093)

**Comprehensive Error Capture**: Detailed error logging with proxy log tail extraction for debugging (L643-693)

**Toolchain Compatibility**: Handles MSVC toolchain detection with configurable behavior (L695-741)

### Event-Driven Operations

**Dry Run Handling**: `waitForDryRunCompletion()` (L300-356) uses event listeners with timeout for spawn validation

**Step Completion**: Promise-based step operations with multiple event handlers (stopped, terminated, exited) and 5-second timeouts

**Session Readiness**: Policy-driven readiness detection with adapter-configured and stopped event handling (L511-614)

### Notable Implementation Details

**Location Capture**: Step operations attempt to capture current location from stack trace after stopped events (L1018-1039)

**Frame Detection**: Expression evaluation automatically resolves current frame when not provided (L1189-1235)

**Logging Integration**: Structured logging for breakpoint verification and expression evaluation with 'debug:breakpoint' and 'debug:evaluate' tags

**Timeout Management**: Consistent 30-second adapter readiness timeout and 5-second step operation timeouts