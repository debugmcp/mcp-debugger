# src/implementations/process-manager-impl.ts
@source-hash: 5605097425cb62b3
@generated: 2026-02-10T00:41:46Z

## ProcessManagerImpl

**Purpose**: Concrete implementation of IProcessManager interface that wraps Node.js child_process module for process spawning and execution.

**Key Components**:

- **ProcessManagerImpl class (L10-42)**: Main implementation class that provides process management capabilities
  - Implements IProcessManager interface from @debugmcp/shared
  - Wraps Node.js child_process functionality with consistent interface

**Methods**:

- **spawn() (L11-14)**: Creates child processes using Node.js spawn()
  - Parameters: command (string), args (string[]), options (SpawnOptions)
  - Returns: IChildProcess (casted from Node.js ChildProcess)
  - Direct passthrough to Node.js spawn with type casting

- **exec() (L16-41)**: Executes commands and returns stdout/stderr
  - Uses promisified version of Node.js exec()
  - Handles multiple return type scenarios for testing compatibility:
    - Standard object with stdout/stderr properties (L21-23)
    - Array format [stdout, stderr] for mocked environments (L26-28)
    - String-only stdout with empty stderr fallback (L31-33)
  - Includes fallback warning and type casting for unexpected cases (L39-40)

**Dependencies**:
- Node.js child_process module (spawn, exec, SpawnOptions)
- util.promisify for async exec wrapper
- @debugmcp/shared for IProcessManager and IChildProcess interfaces

**Architecture Notes**:
- Type casting used to bridge Node.js ChildProcess with custom IChildProcess interface
- Multi-case handling in exec() suggests accommodation for different testing environments
- Defensive programming with console.warn for unexpected execution paths