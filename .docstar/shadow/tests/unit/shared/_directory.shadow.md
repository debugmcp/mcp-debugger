# tests/unit/shared/
@generated: 2026-02-09T18:16:12Z

## Overall Purpose

The `tests/unit/shared` directory contains comprehensive unit tests for the shared infrastructure layer that supports debugging adapters across multiple languages and environments. This test suite validates the adapter policy system, filesystem abstractions, and core debugging protocol implementations that form the foundation for language-specific debug adapter coordination.

## Key Components & Architecture

### Adapter Policy System Tests
The directory primarily tests the adapter policy abstraction layer through multiple implementations:

- **DefaultAdapterPolicy** (`adapter-policy-default.test.ts`): Tests the fallback/no-op policy ensuring safe defaults when no specific adapter is available
- **JsDebugAdapterPolicy** (`adapter-policy-js.test.ts`): Validates JavaScript/Node.js specific debugging behaviors including DAP command sequencing, variable filtering, and stack frame processing
- **PythonAdapterPolicy** (`adapter-policy-python.test.ts`): Tests Python debugger integration including debugpy command recognition and executable path resolution
- **MockAdapterPolicy** (`adapter-policy-mock.test.ts`): Validates testing/development adapter functionality for simulation scenarios

### Infrastructure Tests
- **Filesystem Abstraction** (`filesystem.test.ts`): Tests the NodeFileSystem implementation and global filesystem instance management, providing a testable interface for file operations

## Test Coverage & Patterns

### Core Functionality Validation
All adapter policy tests follow consistent patterns:
- **State Management**: Testing initialization, configuration, and connection state tracking
- **Command Processing**: Validating DAP protocol command handling, queueing, and sequencing
- **Variable/Frame Filtering**: Testing language-specific debugging data extraction and filtering
- **Child Session Handling**: Validating multi-session debugging coordination capabilities
- **Adapter Matching**: Testing command/configuration recognition for routing to appropriate adapters

### Integration Testing
The test suite includes complex integration scenarios:
- **Handshake Flows**: Full DAP initialization sequences with mocked EventEmitter coordination
- **Async State Transitions**: Using fake timers for precise async behavior validation
- **Environment Isolation**: Proper setup/teardown for platform-specific behaviors

## Public API Surface

The tests validate the primary entry points of the shared debugging infrastructure:

### Adapter Policy Interface
- `matchesAdapter()`: Command/configuration recognition
- `buildChildStartArgs()`: Multi-session debugging configuration  
- `createInitialState()`: State initialization
- `updateStateOnEvent/Command/Response()`: State transition management
- `extractLocalVariables()`: Language-specific variable filtering
- `filterStackFrames()`: Stack trace processing
- `shouldQueueCommand()`: Command ordering logic

### Filesystem Interface
- `existsSync()`: File existence checking with error handling
- `readFileSync()`: Safe file reading with fallback behavior
- `setDefaultFileSystem()/getDefaultFileSystem()`: Global instance management

## Internal Organization & Data Flow

The test suite reveals a layered architecture:

1. **Abstract Policy Layer**: Common interface for all adapter implementations
2. **Language-Specific Policies**: Concrete implementations with specialized behaviors
3. **State Management**: Centralized debugging session state tracking
4. **Command Coordination**: DAP protocol message routing and sequencing
5. **Infrastructure Services**: Filesystem and utility abstractions

## Testing Framework & Conventions

- **Vitest**: Primary testing framework across all test files
- **Mock Management**: Comprehensive mocking with proper cleanup and isolation
- **Type Safety**: Strategic use of type assertions for test data structures
- **Environment Simulation**: Platform-specific behavior testing with controlled environment manipulation
- **Integration Patterns**: Complex async scenarios using EventEmitter coordination and fake timers

The test suite ensures robust validation of the debugging infrastructure that supports multiple language adapters while maintaining consistent interfaces and safe fallback behaviors.