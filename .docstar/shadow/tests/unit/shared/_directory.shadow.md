# tests\unit\shared/
@generated: 2026-02-12T21:05:44Z

## Unit Tests for Shared Debug Adapter Infrastructure

This directory contains comprehensive unit tests for the shared debugging infrastructure components used across multiple debug adapters. The tests validate adapter policies, filesystem abstractions, and core debugging protocols.

### Overall Purpose

The test suite ensures the reliability of the plugin-based debug adapter architecture, where different language-specific adapter policies (JavaScript, Python, Mock) implement a common interface for managing debug sessions, command queuing, variable extraction, and state management.

### Key Components and Relationships

#### Adapter Policy Testing (`adapter-policy-*.test.ts`)
- **DefaultAdapterPolicy**: Tests the safe no-op fallback implementation providing default behaviors when no specific adapter policy is available
- **JsDebugAdapterPolicy**: Comprehensive testing of JavaScript/Node.js debugging including command queueing, variable filtering, stack frame processing, and DAP handshake flows
- **PythonAdapterPolicy**: Tests Python-specific debugging features including executable path resolution, environment handling, and debugpy adapter detection  
- **MockAdapterPolicy**: Tests the mock adapter used for development and testing scenarios

All adapter policies implement a common interface pattern with methods for:
- State management (`createInitialState`, `updateStateOnEvent`, `updateStateOnCommand`)
- Debug session lifecycle (`buildChildStartArgs`, `isChildReadyEvent`)
- Variable and stack frame processing (`extractLocalVariables`, `filterStackFrames`)
- Command flow control (`shouldQueueCommand`, `processQueuedCommands`)
- Adapter detection and configuration (`matchesAdapter`, `getDapAdapterConfiguration`)

#### Filesystem Abstraction Testing (`filesystem.test.ts`)
Tests the `NodeFileSystem` implementation that provides a safe filesystem abstraction layer with error handling and fallback behaviors.

### Public API Surface

The tests validate these main entry points:
- **Adapter Policy Interface**: Language-specific debug session management
- **State Management API**: Initialization tracking and connection status
- **Command Processing**: DAP command queueing and ordering logic
- **Variable Extraction**: Language-aware filtering of debug variables
- **Filesystem Operations**: Safe file system operations with error handling

### Internal Organization and Data Flow

The tests follow a consistent pattern:
1. **Initialization**: Adapter policies manage debug session startup and configuration
2. **Command Flow**: Commands are queued and ordered based on adapter-specific requirements
3. **State Tracking**: Session state is maintained through event and command updates
4. **Data Processing**: Variables and stack frames are filtered based on language semantics
5. **Integration**: Full handshake flows test end-to-end debug session establishment

### Important Patterns and Conventions

- **Polymorphic Adapter Design**: Common interface with language-specific implementations
- **Safe Defaults**: Error handling with graceful fallbacks (DefaultAdapterPolicy, filesystem operations)
- **State Machine Pattern**: Debug sessions managed through well-defined state transitions
- **Event-Driven Architecture**: State updates triggered by DAP events and responses
- **Command Queueing**: Order-dependent command execution based on initialization phases
- **Mock-Friendly Design**: Comprehensive test coverage using Vitest mocking capabilities

The test suite ensures robust debugging support across multiple languages while maintaining a consistent programming model and error handling approach.