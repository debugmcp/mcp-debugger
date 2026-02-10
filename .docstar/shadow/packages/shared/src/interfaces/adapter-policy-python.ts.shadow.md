# packages/shared/src/interfaces/adapter-policy-python.ts
@source-hash: cfc363d8bade0fa7
@generated: 2026-02-10T00:41:10Z

## Python Debug Adapter Policy

Implements the `AdapterPolicy` interface for Python's debugpy debug adapter protocol. Defines Python-specific debugging behaviors, variable handling, and session management strategies.

### Core Configuration
- **name**: 'python' (L13)
- **childSessionStrategy**: 'none' - Python doesn't support child debug sessions (L15)
- **supportsReverseStartDebugging**: false (L14)

### Key Methods

**Variable Extraction (L27-85)**
- `extractLocalVariables`: Filters Python locals from stack frames, excluding special variables (__dunder__, _pydev, etc.) unless explicitly requested
- Searches for "Locals" or "Local" scope names (L46-48)
- Preserves common dunder variables like `__name__`, `__file__`, `__doc__` (L71-72)

**Executable Resolution (L100-115)**
- `resolveExecutablePath`: Resolves Python executable with priority: provided path > PYTHON_PATH env > platform default
- Uses 'python' on Windows, 'python3' on Unix-like systems (L114)

**Executable Validation (L132-161)**
- `validateExecutable`: Critical Windows Store alias detection to avoid false Python executables
- Spawns test process with exit code 9009 detection and stderr parsing for Store indicators (L148-152)

**Command Handling**
- `requiresCommandQueueing`: Returns false - Python processes commands immediately (L166)
- `shouldQueueCommand`: No command queuing needed (L171-178)

**State Management (L183-221)**
- `createInitialState`: Tracks initialized/configurationDone flags
- `updateStateOnCommand`/`updateStateOnEvent`: Updates state on 'configurationDone'/'initialized' events
- `isConnected`/`isInitialized`: State checks based on initialized flag

**Adapter Matching (L226-235)**
- `matchesAdapter`: Detects debugpy/python in command strings and arguments
- Looks for 'debugpy', 'python', or '-m debugpy' patterns

**DAP Client Behavior (L247-274)**
- Minimal reverse request handling - only acknowledges 'runInTerminal' (L250-256)
- No child session routing, mirroring, or special timeouts needed

**Adapter Spawn Configuration (L279-307)**
- `getAdapterSpawnConfig`: Builds debugpy adapter command with host/port/log-dir args
- Uses custom adapter command if provided, otherwise constructs `python -m debugpy.adapter` command

### Dependencies
- `@vscode/debugprotocol` - Debug protocol types
- `./adapter-policy.js` - Core policy interface
- `@debugmcp/shared` - SessionState enum
- `../models/index.js` - StackFrame, Variable types
- `./dap-client-behavior.js` - DAP client interfaces

### Architecture Notes
- Implements single-session debugging only (no child sessions)
- Focuses on local variable filtering for Python-specific debugging experience
- Handles Windows-specific Python executable validation edge cases
- Uses standard DAP flow without command queueing requirements