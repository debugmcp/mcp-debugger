# packages\shared\tests/
@generated: 2026-02-12T21:01:11Z

## Purpose and Responsibility

This directory contains comprehensive unit tests for the MCP Debug framework's shared components, specifically focused on validating language-specific debug adapter policies. The tests ensure that different programming language debuggers (JavaScript/Node.js and Rust) integrate correctly with the Debug Adapter Protocol (DAP) while maintaining consistent behavior patterns across the framework.

## Key Components and Relationships

### Unit Test Suite (`unit/`)
The primary component containing language-specific adapter policy tests that validate:
- **Debug Adapter Policy Implementations**: Tests for `JsDebugAdapterPolicy` and `RustAdapterPolicy` classes
- **DAP Protocol Compliance**: Validation of command queueing, initialization flows, and reverse debugging capabilities
- **Cross-Platform Compatibility**: Platform-specific configuration and executable resolution testing
- **Variable Management**: Filtering of debugger internals vs user variables with configurable handling

### Shared Testing Architecture
All tests follow consistent patterns for:
- Mock-based testing with systematic cleanup
- Event-driven asynchronous operation validation
- Platform simulation and environment override capabilities
- Type-safe mock implementations maintaining original API signatures

## Public API Testing Surface

### Core Adapter Functionality Validation
- `buildChildStartArgs()`: Debug target attachment configuration testing
- `filterStackFrames()`: Stack frame filtering with internal/user code separation
- `extractLocalVariables()`: Scope-based variable extraction with debugger internal filtering
- `matchesAdapter()`: Process identification and adapter detection validation
- `getAdapterSpawnConfig()`: Platform-specific spawning configuration testing

### Session Lifecycle Management
- Initialization workflow testing (`initialize()`, `configurationDone()`)
- Command queueing and ordering validation during session startup
- State management verification including connection and readiness tracking
- Child session creation and management testing

## Internal Organization and Data Flow

### Test Execution Flow
1. **Setup Phase**: Mock initialization, platform configuration, and test data preparation
2. **Execution Phase**: Isolated functionality testing with comprehensive mock objects
3. **Validation Phase**: State verification and behavior assertion
4. **Cleanup Phase**: Systematic mock reset and resource cleanup

### Mock Strategy and Patterns
- **File System Operations**: Mock fs/promises for executable validation
- **Process Management**: EventEmitter-based child process simulation
- **DAP Protocol**: Mock client contexts for reverse request handling
- **Platform Environment**: Temporary architecture/platform overrides for cross-platform testing

## Important Patterns and Conventions

### Testing Standards
- Consistent use of vitest framework with structured mock management
- Type-safe implementations ensuring API compatibility
- Edge case validation including error conditions and empty data sets
- Event-driven testing patterns for asynchronous debug operations

### Language-Specific Test Focus
- **JavaScript Tests**: Node.js internals filtering and complex DAP initialization flows
- **Rust Tests**: CodeLLDB integration and executable binary validation via version checking

### Cross-Cutting Validation Concerns
- **Protocol Compliance**: All adapters must handle DAP commands consistently
- **Variable Extraction**: Uniform filtering patterns across different debugger types
- **State Management**: Standardized session lifecycle across language implementations
- **Platform Agnostic**: Behavior validation across different operating systems and architectures

This test directory serves as the quality assurance foundation for the MCP Debug framework's shared components, ensuring reliable debugging experiences across multiple programming languages while maintaining consistent API behavior and protocol compliance.