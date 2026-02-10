# packages/shared/src/interfaces/adapter-policy-python.ts
@source-hash: cfc363d8bade0fa7
@generated: 2026-02-09T18:14:14Z

## Python Debug Adapter Policy Implementation

This file implements a comprehensive adapter policy for Python's debugpy debug adapter, encapsulating all Python-specific debugging behaviors and configurations within the larger debug adapter framework.

### Core Purpose
The `PythonAdapterPolicy` (L12-308) serves as a configuration and behavior definition for Python debugging sessions, implementing the `AdapterPolicy` interface to handle Python-specific debug protocol nuances, variable extraction, and adapter lifecycle management.

### Key Components

**Policy Configuration (L12-23)**
- Defines adapter name as 'python' and disables reverse debugging support
- Sets child session strategy to 'none' since Python doesn't use multi-session debugging
- Configures event handling for initialization detection

**Variable Management (L27-92)**
- `extractLocalVariables()` (L27-85): Core logic for filtering Python variables from debug scopes
  - Extracts from top stack frame's "Locals" scope
  - Filters out Python internals: dunder variables, debugger variables (`_pydev`, `_`)
  - Preserves common dunders like `__name__`, `__file__`, `__doc__`
- `getLocalScopeName()` (L90-92): Returns Python's standard scope name

**Executable Resolution (L100-161)**
- `resolveExecutablePath()` (L100-115): Handles Python executable discovery with fallback chain
- `validateExecutable()` (L132-161): Critical Windows validation to detect/reject Microsoft Store Python aliases
  - Uses child process execution to test real Python availability
  - Detects Windows Store redirect patterns in stderr

**Adapter Configuration (L94-124)**
- `getDapAdapterConfiguration()`: Sets debugpy as adapter type
- `getDebuggerConfiguration()`: Configures Python debugger capabilities (variable types supported)

**Command and State Management (L166-221)**
- No command queueing required for Python adapter
- State tracking for initialization and configuration completion
- Session readiness tied to PAUSED state

**Adapter Matching (L226-235)**
- `matchesAdapter()`: Detects Python debugging contexts via command/args analysis
- Looks for 'debugpy', 'python', or '-m debugpy' patterns

**DAP Client Integration (L247-274)**
- `getDapClientBehavior()`: Minimal reverse request handling since Python uses single-session model
- Standard timeout configurations without child session complexity

**Adapter Spawning (L279-307)**
- `getAdapterSpawnConfig()`: Constructs debugpy adapter launch command
- Supports custom adapter commands or builds standard `python -m debugpy.adapter` invocation
- Handles host/port/logging configuration

### Dependencies
- Imports from VSCode Debug Protocol, shared models, and adapter policy interfaces
- Runtime imports child_process for executable validation
- Integrates with SessionState enumeration

### Architecture Notes
- Single-session debugging model (no child processes)
- Focuses on local variable extraction and filtering for Python semantics
- Emphasizes Windows compatibility with Store Python detection
- Minimal DAP client behavior due to straightforward Python debugging model