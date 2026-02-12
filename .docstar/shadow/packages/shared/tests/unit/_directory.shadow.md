# packages\shared\tests\unit/
@generated: 2026-02-12T21:00:57Z

## Purpose and Responsibility

This directory contains comprehensive unit tests for language-specific debug adapter policies within the MCP Debug framework. The tests validate the implementation of Debug Adapter Protocol (DAP) handling for different programming languages, focusing on JavaScript/Node.js and Rust debugging capabilities.

## Key Components

### JavaScript Debug Adapter Tests (`adapter-policy-js.spec.ts`)
- Tests `JsDebugAdapterPolicy` class functionality
- Validates DAP command queueing and initialization flow management
- Tests stack frame filtering to remove Node.js internals
- Verifies variable extraction with configurable special variable handling
- Tests adapter detection, spawning, and client behavior

### Rust Debug Adapter Tests (`adapter-policy-rust.test.ts`)  
- Tests `RustAdapterPolicy` class functionality
- Validates executable resolution and binary validation via version checking
- Tests CodeLLDB adapter integration and platform-specific configurations
- Verifies variable extraction and debugger internal filtering
- Tests state management and DAP protocol handling

## Test Architecture and Patterns

### Common Testing Utilities
- Mock stack frame generation for consistent test data
- Platform simulation capabilities for cross-platform validation
- Child process mocking with EventEmitter-based simulation
- Extensive use of vitest framework with systematic mock cleanup

### Shared Testing Concerns
- **Variable Extraction**: Both adapters test filtering of debugger internals vs user variables with configurable special variable inclusion
- **State Management**: Session lifecycle tracking including connection, initialization, and configuration states
- **DAP Protocol Compliance**: Command queueing, initialization flows, and reverse debugging request handling
- **Platform Compatibility**: Cross-platform executable resolution and adapter spawning
- **Adapter Detection**: Process identification through command/argument analysis

## Public API Testing Surface

### Core Adapter Functionality
- `buildChildStartArgs()`: Debug target attachment configuration
- `filterStackFrames()`: Internal frame filtering with fallback preservation
- `extractLocalVariables()`: Scope-based variable extraction
- `matchesAdapter()`: Adapter process identification
- `getAdapterSpawnConfig()`: Platform-specific spawn configuration

### State and Lifecycle Management
- `initialize()` and `configurationDone()` workflow validation
- Command queueing and ordering during session startup
- Session readiness determination based on connection state
- Child session creation and management

## Internal Organization

### Test Data Flow
1. **Setup Phase**: Mock initialization and platform configuration
2. **Test Execution**: Isolated functionality testing with mock objects
3. **Cleanup Phase**: Systematic mock reset between tests

### Mock Strategy
- **File System**: Access validation through fs/promises mocking
- **Process Management**: Child process spawn behavior simulation
- **DAP Protocol**: Mock client contexts for reverse request testing
- **Platform Environment**: Temporary platform/architecture overrides

## Important Patterns and Conventions

### Testing Standards
- Type-safe mock implementations maintaining original signatures
- Event-driven testing for asynchronous operations
- Edge case validation (empty arrays, error conditions)
- Non-null assertion usage indicating optional method testing

### Language-Specific Considerations
- **JavaScript**: Focus on Node.js internals filtering and DAP initialization complexity
- **Rust**: Emphasis on executable validation and CodeLLDB integration

### Cross-Cutting Concerns
- All adapters implement consistent variable extraction patterns
- State management follows standardized session lifecycle
- Platform-agnostic testing with environment simulation
- DAP compliance validation across different adapter types

This test suite ensures robust adapter policy implementations that can handle diverse debugging scenarios while maintaining consistent behavior patterns across different programming language environments.