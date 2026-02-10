# tests/implementations/test/fake-process-launcher.ts
@source-hash: 11171a39c075f7fc
@generated: 2026-02-10T00:41:35Z

Test implementation of process launcher interfaces providing deterministic, controllable behavior for unit testing. This file contains fake implementations of all process-related interfaces without spawning real processes.

## Core Purpose
Provides controllable test doubles for process management interfaces, enabling deterministic unit testing of process-launching code with simulated process lifecycle events.

## Key Classes and Components

**FakeProcess (L23-91)** - EventEmitter-based process mock
- Implements `IProcess` interface with controllable state
- Properties: `pid`, `stdin/stdout/stderr` (PassThrough streams), process state tracking
- Core methods: `send()` (L45-50), `kill()` (L52-61) with async event emission
- Test helpers: `simulateOutput/Error/Exit/Spawn/ProcessError/Message()` for controlling process behavior
- State tracking via private fields `_killed`, `_exitCode`, `_signalCode`

**FakeProcessLauncher (L96-136)** - Process launcher test double
- Implements `IProcessLauncher` interface
- Tracks launched processes in `launchedProcesses` array with command/args/options
- `launch()` method (L106-116) returns FakeProcess instances
- Test helpers: `prepareProcess()` for pre-configuring next launch, `getLastLaunchedProcess()`, `reset()`

**FakeDebugTargetLauncher (L141-193)** - Debug target launcher mock
- Implements `IDebugTargetLauncher` for Python debugging scenarios
- `launchPythonDebugTarget()` (L153-180) returns IDebugTarget with process and debug port
- Auto-incrementing debug ports starting at 5678
- Tracks launched targets with script path, args, Python path, debug port
- Test helpers: `prepareTarget()`, `reset()`

**FakeProxyProcess (L198-233)** - Extended process mock for proxy scenarios
- Extends FakeProcess, implements `IProxyProcess`
- Tracks sent commands in `sentCommands` array
- `sendCommand()` (L205-209) logs commands and forwards via `send()`
- `waitForInitialization()` (L211-214) simulates async initialization
- Test helpers for simulating initialization success/failure

**FakeProxyProcessLauncher (L238-301)** - Proxy process launcher mock
- Implements `IProxyProcessLauncher`
- `launchProxy()` (L248-281) with automatic init_received response for non-prepped proxies
- Intercepts sendCommand to auto-respond to 'init' commands (L264-278)
- Tracks launched proxies with script path, session ID, environment

**FakeProcessLauncherFactory (L306-329)** - Factory for all fake launchers
- Implements `IProcessLauncherFactory`
- Provides singleton instances of all fake launchers
- Centralized `reset()` method for all fakes

## Dependencies
- Node.js EventEmitter and PassThrough streams for process simulation
- Process interfaces from `../../../src/interfaces/process-interfaces.js`

## Architectural Patterns
- Test Double pattern - controllable fakes instead of real process spawning
- Factory pattern for launcher creation
- EventEmitter-based async simulation matching real Node.js process behavior
- Method interception pattern in FakeProxyProcessLauncher for auto-responses

## Key Testing Features
- Deterministic process IDs (12345)
- Controllable process lifecycle via simulate methods
- Command/launch history tracking for verification
- Pre-configuration of next process/target via prepare methods
- Automatic cleanup via reset methods
- Async event simulation using `process.nextTick()`