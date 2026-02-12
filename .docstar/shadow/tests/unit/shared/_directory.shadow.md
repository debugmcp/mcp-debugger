# tests\unit\shared/
@generated: 2026-02-12T21:00:58Z

## Overview

The `tests/unit/shared` directory contains comprehensive unit tests for the shared debugging infrastructure components, focusing on adapter policy implementations, filesystem abstractions, and core debugging behaviors. This test suite validates the pluggable architecture that allows the debugging system to support multiple language runtimes (JavaScript, Python, Mock) through standardized adapter policies.

## Key Components & Architecture

### Adapter Policy Test Suite
The core of this test directory validates the **adapter policy pattern** - a strategy pattern implementation that encapsulates language-specific debugging behaviors:

- **DefaultAdapterPolicy Tests** (`adapter-policy-default.test.ts`): Validates the base no-op implementation that provides safe defaults for all adapter policy interface methods
- **JsDebugAdapterPolicy Tests** (`adapter-policy-js.test.ts`): Comprehensive testing of JavaScript/Node.js debugging including DAP handshake flows, command queueing, stack frame filtering, and variable extraction
- **PythonAdapterPolicy Tests** (`adapter-policy-python.test.ts`): Python-specific debugging behaviors including environment path resolution and debugpy adapter integration
- **MockAdapterPolicy Tests** (`adapter-policy-mock.test.ts`): Test adapter implementation for development and testing scenarios

### Filesystem Abstraction Tests
**NodeFileSystem Tests** (`filesystem.test.ts`): Validates the filesystem abstraction layer that provides safe fallbacks when Node.js fs operations fail, ensuring robust file system interactions across the debugging infrastructure.

## Public API Surface

The tests validate these key adapter policy interface methods:
- **Adapter Identification**: `matchesAdapter()` - Runtime detection of appropriate adapter policies
- **State Management**: `createInitialState()`, `updateStateOnEvent()`, `updateStateOnCommand()`, `isInitialized()`, `isConnected()`
- **Child Session Handling**: `buildChildStartArgs()`, `isChildReadyEvent()`
- **Variable/Stack Filtering**: `extractLocalVariables()`, `filterStackFrames()`
- **Command Orchestration**: `shouldQueueCommand()`, `processQueuedCommands()`, `performHandshake()`
- **Configuration**: `getDapAdapterConfiguration()`, `getInitializationBehavior()`, `resolveExecutablePath()`

## Internal Organization & Data Flow

### Testing Patterns
1. **Adapter Detection Flow**: Tests validate how the system identifies which adapter policy to use based on command signatures and runtime context
2. **State Transition Testing**: Comprehensive validation of debug session lifecycle from initialization through configuration completion
3. **Integration Testing**: Full handshake flow testing with mocked EventEmitter-based proxy managers and fake timers
4. **Error Handling**: Safe fallback behaviors when underlying operations fail

### Cross-Component Dependencies
- All adapter policies implement the same interface contract, validated through consistent test patterns
- Filesystem abstraction provides foundation for configuration and executable resolution across all adapters
- Mock implementations enable testing of the policy pattern without runtime dependencies

## Important Conventions

### Test Structure Patterns
- Extensive use of Vitest mocking (`vi.fn()`) for DAP request simulation
- Environment variable manipulation with proper cleanup in beforeEach/afterEach hooks
- Type assertions (`as any`) for simplified test data structures
- Optional chaining (`?.`) usage indicating conditionally defined policy methods

### State Management Testing
- Event-driven state updates with separate handlers for DAP events vs commands
- Initialization tracking through `initialized` and `configurationDone` flags
- Connection state management tied to debug readiness events

### Integration Test Approach
- Real filesystem operations for integration-style testing combined with error simulation
- Full DAP handshake simulation with timing control
- Cross-platform testing with process.platform spoofing

This test suite ensures the shared debugging infrastructure maintains consistent behavior across different language runtimes while providing the flexibility needed for language-specific debugging requirements.