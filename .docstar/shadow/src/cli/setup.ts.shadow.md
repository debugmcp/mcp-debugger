# src/cli/setup.ts
@source-hash: 816cd37b9915b5f3
@generated: 2026-02-10T00:41:46Z

## Purpose
CLI command setup and configuration module for a multi-transport server system, providing standardized command line interfaces for stdio, SSE (Server-Sent Events), and Rust binary analysis operations.

## Key Types and Interfaces
- **StdioOptions** (L3-6): Configuration for stdio transport with optional logging controls
- **SSEOptions** (L8-12): Configuration for SSE transport including required port and optional logging
- **CheckRustBinaryOptions** (L14-16): Options for Rust binary analysis with optional JSON output
- **Handler Types** (L18-24): Type aliases for async command handlers that accept options and optional Command objects

## Core Functions

### createCLI (L26-35)
Factory function that creates a new Commander.js program instance with basic metadata (name, description, version).

### setupStdioCommand (L37-48)
Configures the default 'stdio' command with:
- Log level option (default: 'info')
- Optional log file output
- Sets `CONSOLE_OUTPUT_SILENCED` environment variable to prevent console pollution in stdio transport

### setupSSECommand (L50-62)
Configures the 'sse' command with:
- Port option (default: '3001')
- Log level and file options matching stdio
- Also sets console silencing for transport protection

### setupCheckRustBinaryCommand (L64-76)
Configures 'check-rust-binary' command for analyzing Rust executables:
- Requires binary path as argument
- Optional JSON output format
- No console silencing (analysis output expected)

## Architecture Patterns
- **Handler Injection**: Commands accept handler functions, enabling dependency injection and testability
- **Consistent Option Patterns**: Logging options (`-l/--log-level`, `--log-file`) standardized across transport commands
- **Environment-based Control**: Uses `CONSOLE_OUTPUT_SILENCED` to coordinate logging behavior across the application
- **Transport Isolation**: Different commands for different communication protocols (stdio vs SSE)

## Dependencies
- **commander**: CLI framework for argument parsing and command structure

## Critical Behaviors
- Console output is explicitly silenced for stdio/SSE commands to prevent interference with transport protocols
- Default command is stdio, making it the primary interface
- All handlers are async and receive both parsed options and the Commander command object for extended functionality