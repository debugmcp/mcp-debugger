# tests\core\unit\session/
@generated: 2026-02-12T21:01:00Z

## Purpose
Unit test suite for SessionManager - the core session orchestration component of the debugMCP system. Validates session lifecycle management, Debug Adapter Protocol (DAP) operations, error handling, multi-session coordination, and state machine integrity through comprehensive test coverage.

## Test Architecture
The test suite follows a modular architecture with shared utilities and focused test domains:

### Core Test Utilities (`session-manager-test-utils.ts`)
- **createMockDependencies()**: Central factory providing complete mock ecosystem including MockProxyManager, file system, logger, network manager, and adapter registry
- **Mock environment setup**: Consistent dependency injection patterns across all test suites
- **Isolation guarantee**: Global vi.mock() calls prevent real system dependencies during testing

### Test Domain Organization
- **State Management**: `models.test.ts`, `session-manager-state.test.ts` - Session state transitions and backward compatibility
- **Core Workflows**: `session-manager-workflow.test.ts`, `session-manager-integration.test.ts` - End-to-end debugging cycles
- **DAP Operations**: `session-manager-dap.test.ts` - Breakpoints, stepping, variable inspection, stack traces
- **Error Scenarios**: `session-manager-error-recovery.test.ts`, `session-manager-edge-cases.test.ts` - Failure modes and recovery
- **Reliability**: `session-manager-memory-leak.test.ts`, `session-manager-multi-session.test.ts` - Resource management and concurrency
- **Platform Support**: `session-manager-paths.test.ts` - Cross-platform path handling
- **Timing**: `session-manager-dry-run.test.ts` - Race conditions and timeout handling

## Key Testing Patterns
- **Fake Timer Control**: All tests use `vi.useFakeTimers()` for deterministic async behavior
- **Mock Proxy Simulation**: MockProxyManager with controllable event emission and failure modes
- **State Verification**: Consistent pattern of validating state transitions at each lifecycle phase
- **Error Injection**: Strategic mocking to test failure scenarios and recovery mechanisms
- **Event-Driven Testing**: Simulation of DAP events (stopped, continued, terminated) for state machine validation

## Critical Test Coverage
### Session Lifecycle Management
- Session creation, initialization, and cleanup
- State transitions: CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED/ERROR
- Multi-session isolation and concurrent operation support
- Memory leak prevention through proper event listener cleanup

### DAP Protocol Operations
- Breakpoint management (setting, verification, conditional breakpoints)
- Stepping operations (step over, step into, step out) with timeout handling
- Variable inspection with scope fallback mechanisms
- Stack trace and scope retrieval for debugging contexts

### Error Handling & Recovery
- Proxy crash detection and recovery mechanisms
- Timeout handling for various operations
- Graceful degradation when DAP requests fail
- Resource cleanup on unexpected termination/exit events

### Platform Compatibility
- Windows path handling (drive letters, backslash normalization)
- Cross-platform path resolution for breakpoints
- Path passthrough behavior (normalization handled at server level)

## State Model Validation
Tests validate both legacy single-state model and new dual-state architecture:
- **Legacy States**: CREATED, INITIALIZING, RUNNING, PAUSED, STOPPED, ERROR, READY
- **New Model**: Separate lifecycle states (CREATED, ACTIVE, TERMINATED) and execution states (INITIALIZING, RUNNING, PAUSED, TERMINATED, ERROR)
- **Backward Compatibility**: Bidirectional mapping between models with documented edge cases

## Integration Points
- **ProxyManager**: Process lifecycle and DAP communication management
- **SessionStore**: Session persistence and state tracking
- **Logger**: Comprehensive operation logging and error reporting
- **FileSystem**: Debug file and log directory management
- **NetworkManager**: Port allocation and server setup for debugging

## Quality Assurance Features
- **Race Condition Testing**: Dry run timing scenarios and event emission races
- **Memory Leak Prevention**: Event listener cleanup verification
- **Concurrent Session Support**: Multi-session state isolation testing
- **Error Recovery**: Comprehensive failure scenario coverage
- **Performance Validation**: Timeout handling and timing requirements

This test suite ensures SessionManager robustly handles all aspects of debug session orchestration while maintaining proper isolation, resource management, and error recovery capabilities.