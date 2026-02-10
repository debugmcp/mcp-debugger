# tests/test-utils/mocks/child-process.ts
@source-hash: 9f796df4dca4747d
@generated: 2026-02-10T00:41:36Z

## Child Process Test Mocks

**Primary Purpose**: Provides comprehensive mock implementations for Node.js child_process module functions used throughout test suites. Enables deterministic testing of process spawning, IPC communication, and process lifecycle events.

**Key Classes & Functions**:

### MockChildProcess (L14-89)
- **Purpose**: Mock implementation of Node.js child process with EventEmitter inheritance
- **Key Properties**:
  - `stdin`, `stdout`, `stderr` (L16-18): Stream mocks, stdout/stderr as EventEmitters
  - `pid` (L28): Random process ID assigned in constructor
  - `killed` (L29): Boolean status flag
- **Core Methods**:
  - `kill()` (L21, L36): Mocked kill method that sets killed=true
  - `send()` (L22): Mocked IPC send method, returns true by default
  - `simulateExit(code, signal)` (L45): Emits 'exit' and 'close' events
  - `simulateError(error)` (L53): Emits 'error' event
  - `simulateStdout/Stderr(data)` (L60, L67): Emits data events on streams
  - `simulateMessage(message)` (L74): Emits IPC 'message' event
  - `reset()` (L81): Clears all listeners and resets mock state

### ChildProcessMock (L91-344)
- **Purpose**: Central mock orchestrator for child_process module functions
- **Mock Functions**: `spawn`, `exec`, `execSync`, `fork` (L93-96)
- **State Management**: 
  - `mockProcesses[]` (L99): Tracks all created MockChildProcess instances
  - `reset()` (L108): Resets all mocks and clears process state
  - `setupMocks()` (L126): Configures default implementations

**Specialized Mock Configurations**:

- **`setupPythonSpawnMock(options)`** (L207-249): Configures spawn for Python process simulation with stdout/stderr arrays and exit codes
- **`setupPythonVersionCheckMock(version)`** (L254-283): Configures exec to return Python version strings
- **`setupProxySpawnMock(options)`** (L288-343): Configures spawn for IPC-enabled proxy processes with init message handling

**Default Behaviors**:
- `spawn/fork`: Auto-exit with code 0 after 50ms delay
- `exec`: Returns successful result with "mock stdout output" after 10ms
- `execSync`: Returns Buffer with "mock stdout output"

**Dependencies**:
- `vitest`: Mock function implementation (`vi.fn()`)
- `events.EventEmitter`: Base class for process and stream mocking

**Architectural Patterns**:
- Singleton pattern via exported `childProcessMock` instance (L347)
- Factory pattern for MockChildProcess creation
- Fluent configuration API for specialized test scenarios
- Timeout-based simulation of asynchronous process events

**Exports**:
- Individual mock functions (`spawn`, `exec`, `execSync`, `fork`) (L350-355)
- Default module export with `__childProcessMock` helper (L358-365)
- Direct access to `MockChildProcess` class and singleton instance

**Critical Constraints**:
- Mock processes auto-exit by default (may need override for long-running process tests)
- IPC message handling requires JSON parsing in proxy mock setup
- Stream mocks use EventEmitter casting rather than proper stream implementation