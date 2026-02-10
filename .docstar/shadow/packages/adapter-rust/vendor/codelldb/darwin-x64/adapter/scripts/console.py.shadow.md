# packages/adapter-rust/vendor/codelldb/darwin-x64/adapter/scripts/console.py
@source-hash: b03763844c237fc3
@generated: 2026-02-09T18:12:36Z

## Primary Purpose
LLDB Python console extension that adds custom debugging commands to CodeLLDB adapter. Provides package management and debug information utilities within the debugger environment.

## Key Functions

**pip(debugger, command, result, internal_dict) (L5-13)**
- Custom LLDB command wrapper for pip package manager
- Temporarily modifies sys.argv to parse pip command arguments using shlex
- Executes pip as a module via runpy, ensuring sys.argv restoration on completion
- Enables package installation/management from within LLDB session

**__lldb_init_module(debugger, internal_dict) (L16-23)**
- LLDB module initialization hook (automatically called when module loads)
- Registers 'pip' command via debugger.HandleCommand scripting interface
- Delegates additional command registration to codelldb.commands module
- Prints user-friendly help text showing available custom commands

## Dependencies
- **sys**: Standard library for argv manipulation
- **codelldb.commands**: External module for additional debug command registration
- **runpy**: Standard library for dynamic module execution
- **shlex**: Standard library for shell-like argument parsing

## Architectural Patterns
- Uses LLDB's standard Python module initialization pattern (__lldb_init_module)
- Implements command delegation pattern - core functionality in separate commands module
- Follows LLDB command scripting conventions with required function signature
- Uses context manager pattern (try/finally) for safe argv restoration

## Critical Invariants
- sys.argv must be restored after pip execution to prevent debugger state corruption
- Command registration happens during module initialization phase
- Print statements provide immediate user feedback about available commands