# packages/adapter-java/src/utils/
@generated: 2026-02-10T21:26:22Z

## Overall Purpose

The `packages/adapter-java/src/utils` directory provides essential Java debugging infrastructure for the VS Code Java Debug Adapter. It contains utilities for discovering Java executables, managing the Java Debugger (JDB) process, and parsing JDB's text-based output into structured Debug Adapter Protocol (DAP) data.

## Key Components & Relationships

### 1. Java Environment Discovery (`java-utils.ts`)
- **Java Executable Discovery**: Multi-strategy discovery system finding Java and JDB executables across platforms
- **Version Management**: Java version detection and parsing for compatibility checking
- **Cross-Platform Support**: Windows .exe handling and PATH-based executable resolution
- **Validation**: Executable verification through subprocess calls with timeout protection

### 2. JDB Process Management (`jdb-wrapper.ts`)
- **Process Lifecycle**: Spawns/attaches to JDB processes in both launch and attach modes
- **Command Queue System**: Serialized command execution with timeout handling
- **Event-Driven Architecture**: Emits debugging events (stopped, continued, terminated) via EventEmitter
- **Debugging Operations**: Breakpoint management, execution control, and state inspection

### 3. Output Parsing (`jdb-parser.ts`)
- **Protocol Translation**: Converts JDB's unstructured text output to structured TypeScript interfaces
- **Regex-Based Parsing**: Handles multiple JDB output formats for events, stack traces, variables, and threads
- **DAP Alignment**: All parsed data structures conform to Debug Adapter Protocol requirements
- **Type Inference**: Maps Java values from JDB output to proper type information

## Data Flow & Integration

1. **Discovery Phase**: `java-utils.ts` locates Java/JDB executables on the system
2. **Process Initialization**: `jdb-wrapper.ts` uses discovered executables to spawn JDB processes
3. **Command Execution**: JdbWrapper sends commands to JDB and buffers output
4. **Output Processing**: `jdb-parser.ts` converts JDB text responses into structured events and data
5. **Event Emission**: Parsed events are emitted back to the debug adapter for DAP protocol handling

## Public API Surface

### Java Discovery (`java-utils.ts`)
- `findJavaExecutable(preferredPath?)`: Primary Java discovery with fallback strategies
- `findJdb(javaPath?)`: JDB discovery with Java path derivation
- `getJavaVersion(javaPath)`: Version extraction for compatibility
- `parseJavaMajorVersion(versionString)`: Major version parsing

### JDB Management (`jdb-wrapper.ts`)
- `JdbWrapper` class: Main process manager with EventEmitter interface
  - `spawn(config)` / `attach(config)`: Process initialization
  - `setBreakpoint()` / `clearBreakpoint()`: Breakpoint management
  - `continue()`, `stepOver()`, `stepIn()`, `stepOut()`: Execution control
  - `getStackTrace()`, `getLocals()`, `getThreads()`: State inspection
  - `executeCommand()`: General command execution with queuing

### Output Parsing (`jdb-parser.ts`)
- `JdbParser` static methods for parsing specific JDB outputs:
  - `parseStoppedEvent()`: Breakpoint/step event parsing
  - `parseStackTrace()`: Stack frame extraction
  - `parseLocals()`: Variable parsing with type inference
  - `parseThreads()`: Thread state parsing

## Internal Organization

The utilities follow a layered architecture:
- **Foundation Layer**: Java executable discovery and validation
- **Process Layer**: JDB process management with command queuing
- **Protocol Layer**: Output parsing and DAP protocol alignment

## Important Patterns & Conventions

- **Multi-Strategy Discovery**: Fallback chains for robust executable location
- **Timeout Protection**: All subprocess operations protected with 5-second timeouts
- **Event-Driven Design**: Async debugging operations through EventEmitter patterns
- **Regex-Based Parsing**: Comprehensive pattern matching for JDB's varied output formats
- **Cross-Platform Abstraction**: Consistent behavior across Windows and Unix-like systems
- **Defensive Programming**: Extensive error handling and validation throughout all components

## Dependencies

- **Node.js Built-ins**: `child_process`, `fs`, `path`, `events`
- **External Libraries**: `which` for cross-platform executable discovery
- **Internal Types**: Logger interface and custom error classes

This directory serves as the foundation layer for Java debugging support, providing reliable process management and protocol translation between the raw JDB tool and the structured DAP requirements.