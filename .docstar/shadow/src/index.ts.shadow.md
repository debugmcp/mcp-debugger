# src/index.ts
@source-hash: 9465c92b70be787c
@generated: 2026-02-10T00:42:03Z

## Primary Purpose

Entry point for Debug MCP Server - a step-through debugging server for LLMs using the Model Context Protocol (MCP). Handles critical initialization sequence, console output silencing, and CLI command routing.

## Critical Architecture

**Console Silencing (L12-34)**: IIFE that must execute first to prevent stdout pollution that can corrupt MCP protocol in stdio mode and IPC channels in SSE mode. Silences all console methods and process warnings.

**Argument Processing (L36-39)**: Strips quotes from command-line arguments before any code processes them.

**Container Diagnostics (L71-86)**: Emits file-based startup breadcrumbs when `MCP_CONTAINER=true` to enable debugging in Docker environments without console output.

## Key Functions

- **createDebugMcpServer** (L63-65): Factory function for server instances, accepts ServerOptions
- **main** (L89-113): Primary execution function that sets up logger, error handlers, CLI commands, and parses arguments
- **isMainModule detection** (L118-135): Complex logic to determine if script is running directly vs imported, handles both ESM and CJS contexts

## Dependencies & Relationships

- **Core Server**: `DebugMcpServer` from `./server.js`
- **CLI Framework**: Command setup from `./cli/setup.js`, handlers from `./cli/stdio-command.js`, `./cli/sse-command.js`
- **Utilities**: Logger from `./utils/logger.js`, error handlers from `./cli/error-handlers.js`
- **Version**: `getVersion()` from `./cli/version.js`

## Command Structure

Sets up three main CLI commands:
1. **stdio**: Handles MCP protocol over stdio transport
2. **sse**: Handles MCP protocol over Server-Sent Events transport  
3. **check-rust-binary**: Validates Rust binary availability

## Critical Constraints

- Console output is permanently silenced to prevent protocol corruption
- Main execution only occurs when `DEBUG_MCP_SKIP_AUTO_START !== '1'`
- Container mode enables special file-based logging for diagnostics
- Error handling routes through logger instead of console

## Interface Exports

- **ServerOptions**: Interface for server configuration (logLevel, logFile)
- **Factory function**: `createDebugMcpServer`
- **CLI components**: All setup and handler functions for testing/reuse