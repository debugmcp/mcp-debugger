# packages/adapter-rust/vendor/codelldb/linux-arm64/adapter/scripts/console.py
@source-hash: b03763844c237fc3
@generated: 2026-02-09T18:12:34Z

## Purpose
LLDB debugger extension module that provides additional console commands for the CodeLLDB adapter. Integrates pip package management and custom debugging commands into the LLDB environment.

## Key Functions
- **pip (L5-13)**: Command handler that executes pip commands within the LLDB debugger context. Temporarily modifies `sys.argv` to pass command arguments to pip's main module, then restores original argv state.
- **__lldb_init_module (L16-23)**: LLDB initialization hook that registers the pip command and imports additional commands from the codelldb module. Prints help text for available extra commands.

## Dependencies
- **codelldb.commands**: External module providing additional debugging commands (imported L2, registered L18)
- **runpy**: Standard library for executing modules (used L11)
- **shlex**: Standard library for shell-like argument parsing (used L9)

## Architecture
Module follows LLDB's plugin initialization pattern via `__lldb_init_module`. The pip function acts as a bridge between LLDB's command system and Python's package manager, enabling package installation within the debugger environment.

## Key Behaviors
- Preserves original `sys.argv` state during pip command execution (L8, L13)
- Uses `alter_sys=True` when running pip module to ensure proper argument handling (L11)
- Provides user-friendly help output showing available commands (L20-22)