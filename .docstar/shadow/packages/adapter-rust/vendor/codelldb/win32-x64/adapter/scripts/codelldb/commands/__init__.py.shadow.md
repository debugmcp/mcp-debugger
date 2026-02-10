# packages/adapter-rust/vendor/codelldb/win32-x64/adapter/scripts/codelldb/commands/__init__.py
@source-hash: 92733982c52381e2
@generated: 2026-02-09T18:06:05Z

## Purpose
Command registration module for CodeLLDB debugger extension. Acts as the entry point for registering custom LLDB commands provided by the codelldb package.

## Key Components
- **DebugInfoCommand import (L1)**: Imports debug information inspection command
- **NoFailCommand import (L2)**: Imports failure-resistant command wrapper
- **register() function (L4-7)**: Main registration entry point that:
  - Initializes the codelldb script module in LLDB (L5)
  - Registers 'debug_info' command mapped to DebugInfoCommand class (L6)
  - Registers 'nofail' command mapped to NoFailCommand class (L7)

## Dependencies
- `codelldb.commands.debug_info.DebugInfoCommand`
- `codelldb.commands.nofail.NoFailCommand`
- LLDB debugger API (HandleCommand method)

## Architecture Pattern
Follows LLDB's command extension pattern where Python classes are registered as custom commands through the HandleCommand interface. The register() function serves as a bootstrap mechanism called by LLDB to initialize all available commands.

## Usage Context
Typically invoked during LLDB initialization when the codelldb adapter is loaded, enabling users to access 'debug_info' and 'nofail' commands within the debugger session.