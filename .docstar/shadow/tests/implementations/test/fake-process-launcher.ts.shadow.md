# tests/implementations/test/fake-process-launcher.ts
@source-hash: 11171a39c075f7fc
@generated: 2026-02-09T18:14:47Z

## Purpose
Test implementations providing fake/mock versions of process launcher interfaces for unit testing. Enables deterministic, controllable behavior without spawning real system processes.

## Key Classes

### FakeProcess (L23-91)
Core fake process implementation extending EventEmitter to simulate IProcess behavior:
- **Properties**: Fixed PID (12345), PassThrough streams for stdin/stdout/stderr (L24-27)
- **State tracking**: Private fields for killed status, exit/signal codes (L29-31)
- **IPC simulation**: `send()` method (L45-50) emits message events on next tick
- **Process control**: `kill()` method (L52-61) sets killed state and emits exit/close events
- **Test helpers**: Methods to simulate output (L64-66), errors (L68-70), exit (L72-78), spawn (L80-82), errors (L84-86), and messages (L88-90)

### FakeProcessLauncher (L96-136)
Implements IProcessLauncher interface for testing process spawning:
- **Launch tracking**: `launchedProcesses` array stores all launch attempts with command/args/options (L97-102)
- **Process preparation**: `nextProcess` field allows pre-configuring specific process instances (L104)
- **Launch method**: `launch()` (L106-116) returns prepared or new FakeProcess, auto-triggers spawn event
- **Test helpers**: `prepareProcess()` (L119-123), `getLastLaunchedProcess()` (L126-129), `reset()` (L132-135)

### FakeDebugTargetLauncher (L141-193)
Mock implementation of IDebugTargetLauncher for Python debug target testing:
- **Target tracking**: `launchedTargets` array stores debug session details (L142-148)
- **Port management**: Auto-incrementing `nextDebugPort` starting at 5678 (L150)
- **Launch method**: `launchPythonDebugTarget()` (L153-180) creates IDebugTarget with FakeProcess and terminate function
- **Test helpers**: `prepareTarget()` (L183-185), `reset()` (L188-192)

### FakeProxyProcess (L198-233)
Extends FakeProcess to implement IProxyProcess interface:
- **Session management**: Constructor requires sessionId parameter (L201-203)
- **Command tracking**: `sentCommands` array logs all sent commands (L199)
- **Command sending**: `sendCommand()` (L205-209) logs command and sends as JSON message
- **Initialization**: `waitForInitialization()` (L211-214) returns resolved promise by default
- **Test helpers**: `simulateInitialization()` (L217-223), `simulateInitializationFailure()` (L226-232)

### FakeProxyProcessLauncher (L238-301)
Mock implementation of IProxyProcessLauncher:
- **Launch tracking**: `launchedProxies` array stores proxy launch details (L239-244)
- **Launch method**: `launchProxy()` (L248-281) creates FakeProxyProcess with automatic init_received response for non-prepped proxies
- **Auto-response logic**: Overrides `sendCommand` to automatically respond to 'init' commands (L264-277)
- **Test helpers**: `prepareProxy()` (L284-288), `getLastLaunchedProxy()` (L291-294), `reset()` (L297-300)

### FakeProcessLauncherFactory (L306-329)
Factory implementation providing access to all fake launchers:
- **Singleton instances**: Exposes single instances of each fake launcher type (L307-309)
- **Factory methods**: Standard create methods returning the singleton instances (L311-321)
- **Unified reset**: `reset()` method (L324-328) clears state across all launchers

## Dependencies
- Node.js EventEmitter and PassThrough stream for process simulation
- Process interfaces from `../../../src/interfaces/process-interfaces.js` (L8-17)

## Architectural Patterns
- **Test Double Pattern**: All classes are fakes/mocks implementing production interfaces
- **Builder Pattern**: `prepare*()` methods allow configuring specific behavior before launch
- **Event-driven**: Uses EventEmitter pattern with process.nextTick() for async event simulation
- **State tracking**: Comprehensive logging of all operations for test assertions

## Critical Invariants
- All async operations use process.nextTick() to maintain event loop semantics
- State changes (kill, exit) emit both 'exit' and 'close' events to match real processes
- Proxy processes automatically respond to 'init' commands unless pre-configured
- Factory maintains singleton instances to enable cross-test state inspection