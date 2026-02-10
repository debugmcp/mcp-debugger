# src/interfaces/process-interfaces.ts
@source-hash: 154da350c07447ab
@generated: 2026-02-10T00:41:51Z

## Purpose
Provides high-level abstractions over Node.js child process operations for better testability and domain-specific process management. Defines interfaces for general process launching, Python debug targets, and proxy processes.

## Core Interfaces

### IProcess (L12-25)
Domain-focused abstraction over Node.js ChildProcess. Extends EventEmitter with:
- Standard streams: stdin, stdout, stderr (L14-16)
- Process control: send(), kill() methods (L18-19)
- State tracking: killed, exitCode, signalCode properties (L22-24)
- Optional PID (L13)

### IProcessLauncher (L31-33)
General-purpose process spawning interface with single `launch()` method accepting command, args, and options.

### IProcessOptions (L39-45)
Simplified spawn options focusing on essential parameters:
- Working directory, environment variables (L40-41)
- Shell execution, stdio configuration, detached mode (L42-44)
- Uses `any` type for stdio compatibility (L43)

## Specialized Launchers

### IDebugTargetLauncher (L51-58)
Python debugging specialist with `launchPythonDebugTarget()` method supporting:
- Script path, arguments, custom Python path (L53-55)
- Optional debug port configuration (L56)
- Returns Promise<IDebugTarget>

### IDebugTarget (L64-68)
Encapsulates debug session state:
- Wrapped IProcess instance (L65)
- Debug port tracking (L66)
- Cleanup via terminate() method (L67)

### IProxyProcessLauncher (L74-80)
Proxy process specialist with `launchProxy()` method requiring:
- Proxy script path and session ID (L76-77)
- Optional environment overrides (L78)

### IProxyProcess (L86-90)
Enhanced IProcess for proxy operations:
- Session ID tracking (L87)
- Command sending via sendCommand() (L88)
- Initialization waiting with optional timeout (L89)

## Factory Pattern

### IProcessLauncherFactory (L96-100)
Central factory for creating all launcher types:
- createProcessLauncher() (L97)
- createDebugTargetLauncher() (L98) 
- createProxyProcessLauncher() (L99)

## Dependencies
- Node.js EventEmitter (L6)
- Node.js stream types for stdio (L14-16)

## Architectural Patterns
- Interface segregation: Separate concerns for general, debug, and proxy processes
- Factory pattern: Centralized creation with easy test substitution
- Composition over inheritance: IDebugTarget wraps IProcess rather than extending it