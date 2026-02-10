# tests/unit/implementations/process-launcher-impl-debug.test.ts
@source-hash: e4a4e574a020bf4f
@generated: 2026-02-09T18:14:45Z

## Unit Tests for DebugTargetLauncherImpl

This test suite comprehensively validates the `DebugTargetLauncherImpl` class, which provides Python debug process launching capabilities using the `debugpy` module.

### Core Test Structure

- **Primary Subject**: `DebugTargetLauncherImpl` (L68) - main class under test for launching Python debug targets
- **Mock Infrastructure**: `MockChildProcess` interface (L13-23) and `createMockProcess` helper (L26-45) create realistic process mocks with EventEmitter capabilities
- **Test Dependencies**: ProcessManagerImpl, ProcessLauncherImpl, and NetworkManager mocks for isolated testing

### Key Test Categories

**Launch Python Debug Target Tests (L85-236)**
- Auto port allocation via `findFreePort()` (L86-111)
- Specific port assignment bypassing auto-allocation (L113-139)
- Custom Python interpreter path handling (L141-157)
- Windows path compatibility testing (L159-174)
- Error handling for port allocation failures (L176-184)
- Invalid Python executable error propagation (L186-209)
- Complete debugpy command argument verification (L211-235)

**Process Termination Tests (L238-322)**
- Graceful SIGTERM termination (L239-252)
- Already-terminated process handling (L254-267)
- Force SIGKILL after 5-second timeout (L269-296)
- Immediate resolution when process exits during termination (L298-321)

**Debug Target Properties Tests (L324-360)**
- Process and debug port exposure validation (L325-338)
- Event handling verification for error/exit events (L340-360)

**Edge Case Tests (L362-400)**
- Relative script paths without directories (L363-377)
- File paths with spaces handling (L379-399)

### Critical Test Patterns

- **Resource Cleanup**: `createdTargets` array (L53) tracks all launched targets for proper cleanup in `afterEach` (L72-83)
- **Timer Management**: Fake timers for testing timeout behavior in termination scenarios
- **Process Mocking**: Realistic child process simulation with proper signal handling and event emission
- **Command Verification**: Precise validation of debugpy command construction with listen addresses and client wait flags

### Dependencies & Interfaces

- **External Interfaces**: IChildProcess, INetworkManager, IDebugTarget from process-interfaces
- **Implementation Classes**: DebugTargetLauncherImpl, ProcessLauncherImpl, ProcessManagerImpl
- **Test Framework**: Vitest with comprehensive mocking and timer control capabilities