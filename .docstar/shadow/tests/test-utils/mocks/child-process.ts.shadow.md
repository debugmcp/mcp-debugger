# tests/test-utils/mocks/child-process.ts
@source-hash: 9f796df4dca4747d
@generated: 2026-02-09T18:14:44Z

**Purpose**: Test utility providing comprehensive mocking for Node.js child_process module operations, designed for consistent testing of process spawning, IPC communication, and stream handling.

**Core Components**:

**MockChildProcess (L14-89)** - EventEmitter-based child process simulator
- **Properties**: stdin/stdout/stderr stream mocks (L16-18), pid (random generated, L28), killed status (L29)
- **Methods**: kill() and send() with vi.fn() mocks (L21-25), track killed state on kill()
- **Stream simulation**: simulateStdout/Stderr() emit Buffer data events (L60-69)
- **Event simulation**: simulateExit() emits both 'exit' and 'close' events (L45-48), simulateError() and simulateMessage() for error/IPC scenarios
- **Reset functionality**: removeAllListeners() and clear mock state (L81-88)

**ChildProcessMock (L91-344)** - Main orchestrator class managing all child_process function mocks
- **Mock functions**: spawn, exec, execSync, fork as vi.fn() implementations (L93-96)
- **Process tracking**: maintains mockProcesses array for lifecycle management (L99)
- **Default behaviors**: 
  - spawn/fork auto-exit with code 0 after 50ms delay (L133-135, L177-180)
  - exec returns mock stdout with callback pattern support (L141-165)
  - execSync returns Buffer with mock output (L168-170)

**Specialized Mock Configurations**:
- **setupPythonSpawnMock()** (L207-249): Configurable Python process simulation with stdout/stderr arrays and custom exit codes
- **setupPythonVersionCheckMock()** (L254-283): Detects Python --version commands and returns formatted version strings
- **setupProxySpawnMock()** (L288-343): IPC-aware proxy process with init message response handling and error simulation

**Key Patterns**:
- Uses setTimeout for async behavior simulation with realistic delays
- Callback pattern detection for exec() optional options parameter (L143-146, L257-260)
- JSON message parsing for IPC command handling (L308-332)
- Singleton export pattern with both instance and individual function exports (L346-365)

**Dependencies**: vitest (vi), events (EventEmitter), Node.js stream types

**Usage**: Import childProcessMock singleton or individual functions (spawn, exec, etc.). Use reset() to clear state between tests. Configure specialized behaviors for Python/proxy testing scenarios.