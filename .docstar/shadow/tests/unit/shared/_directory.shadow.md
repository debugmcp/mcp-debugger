# tests/unit/shared/
@generated: 2026-02-11T23:47:45Z

## Purpose
The `tests/unit/shared` directory contains unit tests for the shared debugging infrastructure components, specifically focusing on adapter policy implementations and filesystem abstractions. This test suite validates the extensible adapter policy system that enables debug session management across different programming languages and environments.

## Key Components & Architecture

### Adapter Policy Test Suite
The directory primarily tests the **adapter policy pattern** - a pluggable architecture for managing debug session behavior across different programming languages:

- **`DefaultAdapterPolicy`** (default-adapter-policy.test.ts): Base implementation providing safe no-op behaviors for all adapter policy interface methods. Acts as fallback and template for custom policies.

- **`JsDebugAdapterPolicy`** (adapter-policy-js.test.ts): JavaScript/Node.js debugging specialization with comprehensive features:
  - Child process management for multi-session debugging
  - Command queueing and ordering logic
  - Stack frame filtering (hiding Node.js internals)
  - Variable extraction with special variable handling
  - Complete handshake flow management for both launch and attach modes

- **`PythonAdapterPolicy`** (adapter-policy-python.test.ts): Python debugging specialization with:
  - Executable path resolution with environment variable support
  - Python-specific variable filtering (underscore prefixed variables)
  - Platform-aware default executable selection
  - debugpy adapter detection

- **`MockAdapterPolicy`** (adapter-policy-mock.test.ts): Testing/development utility for adapter development and testing scenarios.

### Filesystem Abstraction
- **`NodeFileSystem`** (filesystem.test.ts): Tests the filesystem abstraction layer that provides safe fallbacks when underlying Node.js fs operations fail, ensuring robust file system interactions.

## Public API Surface

### Core Adapter Policy Interface
All adapter policies implement a consistent interface tested across the suite:
- **State Management**: `createInitialState()`, `updateStateOnEvent()`, `updateStateOnCommand()`, `isInitialized()`, `isConnected()`
- **Command Processing**: `shouldQueueCommand()`, `processQueuedCommands()`, `requiresCommandQueueing()`
- **Session Management**: `buildChildStartArgs()`, `isChildReadyEvent()`, `performHandshake()`
- **Data Filtering**: `extractLocalVariables()`, `filterStackFrames()`
- **Adapter Detection**: `matchesAdapter()`, `resolveExecutablePath()`
- **Configuration**: `getDebuggerConfiguration()`, `getDapAdapterConfiguration()`, `getInitializationBehavior()`

### Filesystem Interface
- **File Operations**: `existsSync()`, `readFileSync()` with error-safe defaults
- **Global Management**: `setDefaultFileSystem()`, `getDefaultFileSystem()`

## Internal Organization & Data Flow

### Test Structure Patterns
1. **Behavior Validation**: Each test suite validates both positive behaviors and error conditions
2. **State Transition Testing**: Comprehensive testing of debug session lifecycle events
3. **Integration Testing**: Full handshake flow testing with mocked DAP communication
4. **Environment Isolation**: Careful setup/teardown to prevent cross-test pollution

### Data Flow Architecture
Tests validate the flow: **Adapter Detection** → **Configuration** → **State Initialization** → **Command Processing** → **Session Management** → **Data Extraction**

## Important Conventions

### Testing Patterns
- **Mock Management**: Extensive use of Vitest mocking with proper cleanup
- **Type Assertions**: Strategic use of `as any` for test data simplification
- **Optional Chaining**: Defensive programming with `?.` for conditional method calls
- **Environment Mocking**: Platform and environment variable simulation for cross-platform testing

### Error Handling
- Safe fallbacks for filesystem operations
- Exception testing for unsupported operations (child sessions)
- Graceful degradation for missing adapter capabilities

### Debug Protocol Integration
- DAP (Debug Adapter Protocol) command/event simulation
- Breakpoint mapping between internal and protocol formats
- Event-driven state management testing

This test suite ensures the adapter policy system can reliably support multiple programming languages while maintaining consistent debugging experiences across different development environments.