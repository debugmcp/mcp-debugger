# tests/core/unit/session/session-manager-workflow.test.ts
@source-hash: da0dc42352e65cec
@generated: 2026-02-10T00:41:20Z

## Purpose
End-to-end integration test suite for SessionManager debug session workflows, validating complete debugging cycles including session creation, debugging start/stop, breakpoint management, and stepping operations.

## Test Structure
- **Main test suite** (L9-149): "SessionManager - Debug Session Workflow"
- **Setup/teardown** (L14-32): Configures fake timers, mock dependencies, and SessionManager instance
- **Complete Debug Cycle tests** (L34-148): Three workflow scenarios

## Key Test Scenarios

### Full Debug Workflow Test (L35-83)
Tests complete debugging lifecycle:
- Session creation with MOCK language (L37-47)
- Debug start with stopOnEntry=true (L50-62)
- Breakpoint setting and verification (L65-72)
- Step over execution (L75-77)
- Session cleanup and state verification (L80-82)

### Dry Run Workflow Test (L85-114)
Validates dry run execution mode:
- Creates session and starts debugging in dry run mode (L92-98)
- Verifies dry run flag propagation (L104, L113)
- Ensures no proxy initialization errors (L108-110)

### StopOnEntry=false Workflow Test (L116-147)
Tests non-breaking execution start:
- Custom mock configuration for continuous execution (L123-130)
- Verifies RUNNING state instead of PAUSED (L143)
- Confirms stopOnEntry parameter propagation (L146)

## Dependencies
- **SessionManager**: Primary class under test from session-manager.js
- **Mock utilities**: createMockDependencies() provides test doubles
- **Shared types**: DebugLanguage.MOCK, SessionState enums
- **Vitest**: Test framework with timer mocking capabilities

## Test Configuration
- Base log directory: '/tmp/test-sessions' (L18)
- Default DAP launch args: stopOnEntry=true, justMyCode=true (L19-22)
- Mock language used throughout for predictable behavior

## Key Assertions
- State transitions: CREATED → PAUSED/RUNNING → STOPPED
- Breakpoint verification and DAP command validation
- Proxy manager interaction verification
- Error condition absence validation