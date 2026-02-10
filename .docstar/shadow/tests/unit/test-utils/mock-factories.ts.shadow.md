# tests/unit/test-utils/mock-factories.ts
@source-hash: af90b2f631182194
@generated: 2026-02-09T18:14:46Z

## Test Utility Mock Factories

Factory functions for creating properly configured mocks with all required properties and methods for successful test execution in Vitest environment.

### Key Factory Functions

**createMockChildProcess() (L15-38)**
Creates a fully configured Node.js ChildProcess mock that extends EventEmitter. Sets all required properties (stdin/stdout/stderr streams, pid, connected state, exit/signal codes) and methods (send, kill, ref, unref, disconnect) with appropriate Vitest spy functions.

**createMockProxyProcess() (L43-54)**
Creates a specialized proxy process mock with send/sendCommand methods, also based on EventEmitter with stdio streams and pid.

**createMockSessionManager() (L59-105)**
Comprehensive mock for session management with debugging capabilities. Provides all session lifecycle methods (create, get, close), debugging operations (breakpoints, stepping, variables, stack traces), and proper async resolution patterns. Returns structured success responses with realistic data.

**createMockAdapterRegistry() (L110-122)**
Mock adapter registry for language support management. Handles language detection, adapter creation/registration, and returns default supported languages (python, mock).

### Utility Mocks

**createMockWhichFinder() (L127-131)**
Command finder mock that always resolves to '/usr/bin/python3' path.

**createMockLogger() (L136-143)**
Standard logging interface mock with debug/info/warn/error methods.

**createMockFileSystem() (L148-162)**
File system operations mock with async methods for directory/file management, returning successful default responses.

**createMockNetworkManager() (L167-171)**
Network utilities mock that provides free port finding (returns 12345).

**createMockEnvironment() (L176-181)**
Environment detection mock with container-related properties.

### Specialized Process Helpers

**createPythonValidationProcess() (L186-195)**
Creates a child process mock that simulates successful Python validation by emitting exit code 0 on next tick.

**createFailedPythonValidationProcess() (L200-209)**
Creates a child process mock that simulates failed Python validation by emitting exit code 1 on next tick.

### Dependencies
- vitest for spy functions
- events.EventEmitter for event handling
- child_process types for process mocking

### Design Patterns
All factories follow consistent patterns:
- Use Vitest spies (vi.fn()) for method mocking
- Provide realistic default return values
- Support both sync and async operations
- Maintain proper TypeScript typing
- Enable event emission where appropriate