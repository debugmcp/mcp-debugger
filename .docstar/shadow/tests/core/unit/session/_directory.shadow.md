# tests/core/unit/session/
@generated: 2026-02-10T21:26:27Z

## Overall Purpose

This directory contains comprehensive unit test coverage for the SessionManager class and its debugging session state models. The test suite ensures robust session lifecycle management, Debug Adapter Protocol (DAP) operations, error recovery, memory leak prevention, and multi-session coordination in a debugging environment.

## Key Components and Relationships

### Core Test Categories

**State Management Tests (`models.test.ts`, `session-manager-state.test.ts`)**
- Validates debugging session state models and transitions
- Tests backward compatibility between legacy SessionState enum and new {lifecycle, execution} model  
- Ensures proper state machine integrity (CREATED → INITIALIZING → PAUSED/RUNNING → STOPPED)
- Covers bidirectional state mapping and round-trip consistency

**DAP Operations Suite (`session-manager-dap.test.ts`)**
- Tests Debug Adapter Protocol integration including breakpoint management, stepping operations (step over/into/out), variable inspection, and stack trace retrieval
- Validates timeout handling and graceful degradation for non-paused sessions
- Ensures proper scope fallback mechanisms for variable retrieval

**Error Handling and Recovery (`session-manager-edge-cases.test.ts`, `session-manager-error-recovery.test.ts`)**
- Comprehensive edge case coverage for error scenarios and boundary conditions
- Tests proxy crash recovery, timeout handling, and graceful failure modes
- Validates error propagation and logging consistency across failure conditions

**Resource Management (`session-manager-memory-leak.test.ts`)**
- Prevents memory leaks through proper event listener cleanup testing
- Validates accumulation prevention across multiple session lifecycles
- Tests cleanup robustness during error conditions and unexpected terminations

**Multi-Session Coordination (`session-manager-multi-session.test.ts`)**
- Ensures concurrent debugging sessions maintain proper state isolation
- Tests bulk session management and resource cleanup
- Validates session independence and error resilience

### Supporting Infrastructure

**Test Utilities (`session-manager-test-utils.ts`)**
- Centralizes mock dependency creation for consistent test isolation
- Provides MockProxyManager, mock file system, logger, and network manager
- Implements dependency injection pattern for SessionManagerDependencies

**Specialized Test Scenarios**
- **Dry Run Testing** (`session-manager-dry-run.test.ts`): Race condition scenarios and timing-sensitive behavior
- **Path Resolution** (`session-manager-paths.test.ts`): Cross-platform path handling and Windows compatibility
- **Integration Testing** (`session-manager-integration.test.ts`, `session-manager-workflow.test.ts`): End-to-end workflow validation

## Public API Surface

### Primary Entry Points
- **SessionManager**: Main class under test with session creation, debugging control, and state management
- **State Models**: SessionState (legacy), SessionLifecycleState, ExecutionState enums with mapping functions
- **Error Types**: ProxyNotRunningError and other debugging-specific exceptions

### Key Testing Interfaces
- **createMockDependencies()**: Factory for SessionManager dependency injection
- **MockProxyManager**: Test double for proxy process management
- **State mapping functions**: `mapLegacyState()`, `mapToLegacyState()` for backward compatibility

## Internal Organization and Data Flow

### Test Execution Flow
1. **Setup Phase**: Fake timers, mock dependencies creation, SessionManager instantiation
2. **Test Execution**: State transitions, DAP operations, error injection, resource monitoring
3. **Verification**: State assertions, mock interaction validation, cleanup confirmation
4. **Teardown**: Timer restoration, mock clearing, resource cleanup

### Mock Architecture
- **Dependency Injection**: All external dependencies (file system, network, logger) are mocked
- **Event Simulation**: MockProxyManager simulates DAP events (stopped, continued, terminated)
- **Timing Control**: Vitest fake timers enable deterministic async behavior testing
- **Resource Tracking**: Event listener counting prevents memory leaks

## Important Patterns and Conventions

### Testing Patterns
- **Fake Timer Usage**: Consistent use of `vi.useFakeTimers()` with `vi.runAllTimersAsync()` for async operations
- **Mock Configuration**: Systematic override of mock behaviors per test scenario
- **State Verification**: Comprehensive state transition validation at each lifecycle step
- **Error Simulation**: Strategic mocking to test failure modes and recovery paths

### Configuration Standards
- **Test Environment**: `/tmp/test-sessions` log directory for isolation
- **Debug Language**: DebugLanguage.MOCK for predictable test behavior
- **DAP Launch Args**: Standard configuration with `stopOnEntry: true`, `justMyCode: true`
- **Timeout Handling**: Consistent 5-second timeouts for DAP operations

### Quality Assurance
- **Coverage Completeness**: Tests cover happy paths, error conditions, edge cases, and race conditions  
- **Memory Safety**: Comprehensive event listener cleanup validation
- **Cross-Platform Support**: Windows path handling and Unix path normalization
- **Backward Compatibility**: Legacy state model compatibility preservation

The test suite ensures SessionManager reliability across all debugging scenarios while maintaining clean resource management and proper error handling throughout the session lifecycle.