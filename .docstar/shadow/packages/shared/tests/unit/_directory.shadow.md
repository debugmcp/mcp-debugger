# packages/shared/tests/unit/
@generated: 2026-02-09T18:16:08Z

## Purpose
This directory contains unit tests for debug adapter policy implementations, providing comprehensive validation of language-specific debug adapter integrations within the debugmcp framework. The tests ensure proper Debug Adapter Protocol (DAP) compliance and adapter lifecycle management.

## Key Components

### Test Files
- **adapter-policy-js.spec.ts**: Tests JavaScript/Node.js debug adapter policy (`JsDebugAdapterPolicy`)
- **adapter-policy-rust.test.ts**: Tests Rust/CodeLLDB debug adapter policy (`RustAdapterPolicy`)

### Shared Testing Patterns
Both test suites follow consistent patterns for validating debug adapter policies:

**Core Functionality Tests**:
- **Variable Extraction**: Tests filtering of debugger internals and special variables
- **State Management**: Validates adapter connection and initialization tracking
- **Command Queuing**: Tests DAP command sequencing and deferred execution
- **Adapter Identification**: Validates pattern matching for adapter recognition
- **Configuration Management**: Tests adapter spawn configuration and initialization behavior

**Integration Testing**:
- **DAP Client Behavior**: Tests reverse request handling and response processing
- **Session Management**: Validates session state tracking and readiness determination
- **Platform Compatibility**: Tests cross-platform behavior and executable validation

## Internal Organization

### Language-Specific Differences
**JavaScript Adapter Policy**:
- Complex command queueing with initialization flow management
- Child session support with pending target adoption
- Node.js internal frame filtering
- Adapter ID normalization ('javascript' → 'pwa-node')

**Rust Adapter Policy**:
- Executable validation with cargo/CodeLLDB integration
- Platform-specific vendored adapter path resolution
- No command queueing (immediate execution)
- No child session support

### Common Test Infrastructure
- **Mock Framework**: Extensive use of vitest mocking for file system, process spawning, and DAP communication
- **Helper Utilities**: Shared patterns for creating mock stack frames, variables, and DAP structures
- **Environment Simulation**: Platform switching and environment variable manipulation
- **State Validation**: Type-safe testing of internal adapter states

## Data Flow

### Test Execution Pattern
1. **Setup Phase**: Mock external dependencies (fs, child_process, DAP clients)
2. **Isolation**: Reset mocks and environment between tests
3. **Validation**: Exercise adapter policy methods with structured test data
4. **Cleanup**: Restore original state and clear environment modifications

### Mock Architecture
- **File System**: Mock `fs/promises.access` for executable validation
- **Process Management**: Mock `child_process.spawn` for adapter process testing
- **DAP Communication**: Mock debug protocol structures and responses
- **Platform Simulation**: Runtime platform switching for cross-platform validation

## Testing Conventions

### Structured Test Data
- Mock stack frames with consistent ID/name/file patterns
- Hierarchical variable structures with scope references
- Platform-specific configuration objects
- DAP command/event simulation with proper typing

### Assertion Patterns
- Non-null assertions for optional method testing
- Type assertions for internal state access
- Mock verification for external dependency interaction
- State mutation validation with before/after comparisons

This test directory ensures robust validation of the debugmcp adapter policy system, providing confidence in multi-language debug adapter integration and DAP protocol compliance.