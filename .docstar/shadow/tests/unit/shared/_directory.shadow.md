# tests/unit/shared/
@generated: 2026-02-10T01:19:42Z

## Test Suite: Shared Infrastructure Unit Tests

**Purpose**: Comprehensive unit test coverage for shared debugging infrastructure components, including adapter policies, filesystem abstractions, and core debugging protocols. This test directory validates the foundational building blocks used across different debugging adapters and ensures robust error handling and state management.

### Key Components & Testing Coverage

#### Adapter Policy Framework
The test suite validates a polymorphic adapter policy system that provides debug-adapter-specific behavior:

- **DefaultAdapterPolicy** (`adapter-policy-default.test.ts`): Tests the base no-op implementation that provides safe defaults for all adapter policy interface methods
- **JsDebugAdapterPolicy** (`adapter-policy-js.test.ts`): Comprehensive testing of JavaScript/Node.js debugging behavior including command queueing, breakpoint management, variable filtering, and DAP handshake flows
- **PythonAdapterPolicy** (`adapter-policy-python.test.ts`): Validates Python-specific debugging features like executable path resolution, environment variable handling, and debugpy adapter detection
- **MockAdapterPolicy** (`adapter-policy-mock.test.ts`): Tests mock adapter functionality for development and testing scenarios

#### Filesystem Abstraction Layer
- **NodeFileSystem** (`filesystem.test.ts`): Tests filesystem abstraction that provides safe defaults when Node.js fs operations fail, including error handling and global instance management

### Public API Surface & Entry Points

#### Core Policy Interface Methods
All adapter policies implement a common interface tested across files:
- `matchesAdapter()` - Adapter detection and matching
- `createInitialState()` / `updateStateOnEvent()` / `updateStateOnCommand()` - State management
- `buildChildStartArgs()` - Child session configuration  
- `extractLocalVariables()` - Debug variable filtering
- `requiresCommandQueueing()` / `shouldQueueCommand()` - Command ordering
- `resolveExecutablePath()` - Runtime executable resolution
- `getInitializationBehavior()` - Debug session setup configuration

#### Filesystem Operations
- `existsSync()` / `readFileSync()` - Safe filesystem operations with error handling
- `setDefaultFileSystem()` / `getDefaultFileSystem()` - Global filesystem instance management

### Internal Organization & Data Flow

#### Debug Session Lifecycle Management
Tests validate the complete debug session flow:
1. **Initialization Phase**: Adapter detection → state creation → configuration
2. **Setup Phase**: Command queueing → breakpoint configuration → handshake
3. **Runtime Phase**: Variable extraction → stack frame filtering → child session handling

#### State Management Pattern
All policies follow event-driven state management:
- Initial state creation with default values
- State updates triggered by DAP events (`initialized`, `configurationDone`)  
- State queries for initialization and connection status

#### Error Handling Strategy
Tests ensure graceful degradation:
- Filesystem operations return safe defaults on errors
- Unsupported operations (child sessions) throw explicit exceptions
- Command queueing provides ordering guarantees during initialization

### Important Testing Patterns

#### Mock-Heavy Integration Testing
- Extensive use of Vitest mocks (`vi.fn()`) for DAP request simulation
- Fake timer control for async handshake flow testing
- Event emitter mocking for proxy manager simulation

#### Environment Isolation
- Proper setup/teardown to prevent test contamination
- Environment variable mocking with restoration
- Platform-specific testing with `process.platform` manipulation

#### Type Safety with Flexibility
- Strategic use of `as any` type assertions for test convenience
- Optional chaining (`?.`) for conditionally defined methods
- Private member access via type assertions for error simulation

This test suite ensures the shared debugging infrastructure provides reliable, adapter-agnostic foundations while supporting specific debugging requirements across different language runtimes.