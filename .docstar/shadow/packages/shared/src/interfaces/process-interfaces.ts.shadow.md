# packages/shared/src/interfaces/process-interfaces.ts
@source-hash: 154da350c07447ab
@generated: 2026-02-10T00:41:09Z

## Purpose
Provides high-level abstraction interfaces for process management, focusing on testability and domain-specific process operations. Wraps Node.js child process functionality with cleaner, more focused APIs.

## Key Interfaces

### Core Process Abstraction
- **IProcess (L12-25)**: High-level process interface extending EventEmitter
  - Wraps Node.js ChildProcess with simplified API
  - Properties: pid, stdin/stdout/stderr streams, lifecycle state (killed, exitCode, signalCode)
  - Methods: send(), kill()
  - Focus on essential functionality rather than full ChildProcess surface

### Process Launch Management
- **IProcessLauncher (L31-33)**: General-purpose process launcher
  - Single method: launch(command, args, options)
  - Returns IProcess instances
  - Higher-level abstraction over spawn/exec

- **IProcessOptions (L39-45)**: Simplified spawn options
  - Essential options: cwd, env, shell, stdio, detached
  - Intentional any type for stdio to maintain Node.js compatibility

### Specialized Launchers
- **IDebugTargetLauncher (L51-58)**: Python debug process launcher
  - Method: launchPythonDebugTarget() - handles debugpy-enabled Python processes
  - Returns Promise<IDebugTarget>
  - Encapsulates debug port and Python path configuration

- **IDebugTarget (L64-68)**: Launched debug target representation
  - Combines process instance with debug connection details
  - Properties: process, debugPort
  - Method: terminate() for cleanup

- **IProxyProcessLauncher (L74-80)**: Proxy process launcher
  - Method: launchProxy() with session-specific configuration
  - Returns IProxyProcess with enhanced functionality

- **IProxyProcess (L86-90)**: Enhanced proxy process interface
  - Extends IProcess with proxy-specific methods
  - Additional properties: sessionId
  - Methods: sendCommand(), waitForInitialization()

### Factory Pattern
- **IProcessLauncherFactory (L96-100)**: Factory for creating launchers
  - Creates all three launcher types
  - Enables easy swapping between production and test implementations
  - Supports dependency injection patterns

## Dependencies
- Node.js EventEmitter for process event handling
- Node.js stream interfaces (WritableStream, ReadableStream)

## Architecture Patterns
- Interface segregation: Specialized interfaces for different process types
- Factory pattern for launcher creation
- Abstraction layer over Node.js child processes
- Promise-based async operations for complex launch scenarios
- Event-driven process management through EventEmitter inheritance