# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/codelldb/commands/
@generated: 2026-02-09T18:16:04Z

## Purpose and Responsibility

This directory contains the command system for the CodeLLDB debugger adapter, implementing custom LLDB commands to enhance debugging capabilities. It provides an extensible framework for registering and executing specialized debugging commands within LLDB sessions.

## Key Components and Integration

**Command Registration System (`__init__.py`)**
- Central entry point that bootstraps the command system
- Registers all available custom commands with LLDB's command interface
- Maps command names to their respective Python class implementations

**Debug Information Inspector (`debug_info.py`)**
- Implements the `debug_info` command for inspecting compilation debug information
- Provides `list` subcommand to enumerate modules with debug info
- Provides `show` subcommand to display compilation units within modules
- Supports both interactive debugging sessions and standalone file inspection

**Command Infrastructure**
- `NoFailCommand` (referenced): Provides failure-resistant command wrapper functionality
- All commands follow LLDB's custom command pattern using `__call__` method interface

## Public API Surface

**Main Entry Point**
- `register()`: Called by LLDB to initialize all custom commands during adapter startup

**Available Commands**
- `debug_info list [regex]`: Lists modules with debug information, optionally filtered
- `debug_info show <module|file>`: Shows compilation units for specified module or file
- `nofail <command>`: Executes commands with failure resistance (wrapper functionality)

## Internal Organization and Data Flow

1. **Initialization Phase**: LLDB calls `register()` during adapter startup
2. **Command Registration**: Each command class is registered with LLDB's HandleCommand interface
3. **Runtime Execution**: User invokes commands → LLDB dispatches to command classes → Commands operate on debug context
4. **Result Handling**: Commands output results through LLDB's result object system with proper flushing

## Architecture Patterns and Conventions

**LLDB Extension Pattern**: Commands implement the standard LLDB custom command interface through callable classes that receive debugger context and result objects.

**Subcommand Architecture**: Uses argparse for sophisticated command-line parsing with subcommands, enabling complex command hierarchies.

**Context-Aware Operations**: Commands operate on current debugging session context (`exe_ctx.target.modules`) but can create standalone debugger instances for file-based operations.

**Error Resilience**: Implements proper exception handling for argparse `SystemExit` to prevent command crashes and maintains LLDB session stability.

## Integration Context

This command system integrates with the broader CodeLLDB adapter by extending LLDB's native command set with Rust-specific debugging capabilities. It operates within the LLDB Python scripting environment and provides enhanced introspection tools for developers debugging Rust applications.