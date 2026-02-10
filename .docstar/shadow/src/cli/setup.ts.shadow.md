# src/cli/setup.ts
@source-hash: 816cd37b9915b5f3
@generated: 2026-02-09T18:15:02Z

## CLI Command Setup Framework

This file provides a comprehensive framework for setting up CLI commands using the Commander.js library. It defines interfaces and factory functions for creating consistent command-line interfaces across different transport modes.

### Core Purpose
- Establishes standardized CLI command patterns for server applications
- Provides type-safe interfaces for command options and handlers
- Handles common logging and transport configuration concerns

### Key Interfaces

**StdioOptions (L3-6)**: Configuration for stdio transport mode, supporting optional log level and file output.

**SSEOptions (L8-12)**: Configuration for Server-Sent Events transport, requiring port specification plus optional logging config.

**CheckRustBinaryOptions (L14-16)**: Simple configuration for Rust binary analysis with JSON output toggle.

### Handler Types

**StdioHandler (L18)**: Async function signature for stdio command execution.

**SSEHandler (L19)**: Async function signature for SSE command execution.

**CheckRustBinaryHandler (L20-24)**: Async function signature for Rust binary analysis, accepting binary path as first argument.

### Core Functions

**createCLI (L26-35)**: Factory function that creates and configures a base Commander program with name, description, and version.

**setupStdioCommand (L37-48)**: Configures the default stdio command with logging options. Sets `CONSOLE_OUTPUT_SILENCED=1` environment variable to prevent console pollution during stdio transport.

**setupSSECommand (L50-62)**: Configures SSE transport command with port and logging options. Also silences console output for transport protection.

**setupCheckRustBinaryCommand (L64-76)**: Configures Rust binary analysis command with required binary path argument and optional JSON output.

### Architecture Patterns
- Uses dependency injection pattern with handler functions passed to setup functions
- Consistent option naming across commands (-l/--log-level, --log-file)
- Environment variable manipulation for transport-specific behavior
- Type-safe command configuration with TypeScript interfaces

### Critical Behavior
- Both stdio and SSE commands automatically set `CONSOLE_OUTPUT_SILENCED=1` to prevent interference with transport protocols
- Stdio command is marked as default (isDefault: true)
- All handlers are async and receive the parsed options plus optional Command reference