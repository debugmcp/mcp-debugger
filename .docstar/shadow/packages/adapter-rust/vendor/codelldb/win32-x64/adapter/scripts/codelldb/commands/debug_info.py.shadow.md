# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/codelldb/commands/debug_info.py
@source-hash: 9e8471bd2cc54e3b
@generated: 2026-02-09T18:06:09Z

## Purpose and Responsibility

LLDB custom command implementation for inspecting debug information in modules. Provides two subcommands: `list` to enumerate modules with debug info, and `show` to display compilation units within specific modules.

## Key Classes and Functions

**DebugInfoCommand (L6-63)**
- Main command class implementing LLDB custom command interface
- `__init__` (L7-14): Sets up argument parser with `list` and `show` subcommands
- `__call__` (L16-27): Entry point for command execution, dispatches to appropriate subcommand
- `sub_list` (L29-34): Lists all modules with debug info, optionally filtered by regex
- `sub_show` (L36-55): Shows compilation units for a specific module or file
- `get_mod_filter` (L57-63): Creates filter function for module matching (regex or all)

## Important Dependencies

- `lldb`: Core LLDB Python API for debugger interaction
- `argparse`: Command-line argument parsing
- `shlex`: Shell-like command string splitting
- `re`: Regular expression matching (imported conditionally on L59)

## Notable Patterns and Architecture

**Command Pattern**: Implements LLDB's custom command interface through `__call__` method that receives debugger context and result objects.

**Subcommand Architecture**: Uses argparse subparsers to handle multiple command modes (`list`/`show`).

**Filter Strategy**: `get_mod_filter` (L57-63) returns lambda functions for module filtering - either regex-based or pass-through.

**Context Handling**: Operates on `exe_ctx.target.modules` for current debugging session, but can also create standalone debugger instances for file inspection (L43-47).

## Critical Invariants and Constraints

- Command must flush results via `result.flush()` (L27)
- Exception handling catches `SystemExit` from argparse to prevent command crashes (L25-26)
- Module iteration assumes valid target context in current debugging session
- File-based module inspection creates temporary debugger instances that must be explicitly destroyed (L47)