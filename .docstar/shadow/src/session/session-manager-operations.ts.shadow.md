# src/session/session-manager-operations.ts
@source-hash: 8db2d657ac2c6ccb
@generated: 2026-02-10T21:25:45Z

## Primary Purpose and Responsibility

SessionManagerOperations (L49-1514) is an abstract class providing core debugging operations for session management. It extends SessionManagerData and implements debugging lifecycle operations including session initialization, stepping, breakpoint management, expression evaluation, and process attachment/detachment. This is the operational core of the debug session management system.

## Key Classes and Interfaces

### EvaluateResult Interface (L35-44)
Result type for expression evaluation operations containing success status, result value, type information, and variable references for DAP protocol compliance.

### SessionManagerOperations Abstract Class (L49-1514)
Core debugging operations class with methods:
- `startProxyManager()` (L50-308): Initializes proxy manager, creates adapter configs, handles dry-run and attach modes
- `startDebugging()` (L371-708): Main session startup orchestration with comprehensive error handling
- `setBreakpoint()` (L711-794): Breakpoint creation and DAP synchronization
- `stepOver()` (L796-836), `stepInto()` (L838-878), `stepOut()` (L880-920): Step execution operations
- `continue()` (L1041-1094): Resume execution operation
- `evaluateExpression()` (L1116-1293): Expression evaluation with context support
- `attachToProcess()` (L1298-1408): Process attachment for remote debugging
- `detachFromProcess()` (L413-1472): Clean detachment from debugged processes

## Important Dependencies and Relationships

### Core Dependencies
- `@debugmcp/shared`: SessionState, Breakpoint, AdapterConfig types (L6-23)
- `@vscode/debugprotocol`: DAP protocol types (L12)
- Session management: ManagedSession, SessionManagerData (L11, L16)
- Error types: SessionTerminatedError, ProxyNotRunningError, DebugSessionCreationError (L25-29)

### Key Relationships
- Extends SessionManagerData for shared session management functionality
- Uses adapter registry pattern for language-specific debug adapter creation (L140)
- Integrates with ProxyManager for DAP communication (L298-305)
- Implements policy-driven session readiness detection (L234-239, L518-521)

## Notable Patterns and Architectural Decisions

### Language-Specific Adapter Pattern
The class uses an adapter registry to create language-specific debug adapters (L140) with transformation methods for launch/attach configurations (L145-152). Adapters handle executable path resolution and command building.

### Dry-Run Execution Support
Sophisticated dry-run mechanism (L403-487) with timeout handling and completion detection for command validation without actual execution.

### Event-Driven Session State Management
Operations use Promise-based event handling with cleanup patterns (L948-1038) for step operations, with timeout protection and comprehensive event listener management.

### Comprehensive Error Handling
Multi-layered error handling with toolchain validation (L658-704), detailed logging with proxy log tail capture (L607-627), and error type normalization for consistent API responses.

### Attach Mode Support
Full support for attaching to running processes (L1298-1408) with auto-detection of suspend state for JDWP connections and proper thread ID management.

## Critical Invariants and Constraints

### Session State Validation
All operations validate session lifecycle state (L720-722, L800-802, L842-844) and throw SessionTerminatedError for terminated sessions.

### Thread ID Requirements
Step and continue operations require valid thread IDs (L816-819, L858-861, L1063-1068) from the proxy manager's current thread context.

### Expression Evaluation Context
Expression evaluation requires PAUSED state (L1142-1150) and valid frame context, with automatic frame detection if not provided (L1152-1198).

### Resource Cleanup
All async operations implement proper cleanup patterns with event listener removal and timeout clearing to prevent memory leaks (L357-368, L951-967).

### Proxy Manager Lifecycle
Operations ensure proxy manager availability and running state before DAP communication, with proper error handling for disconnected states.