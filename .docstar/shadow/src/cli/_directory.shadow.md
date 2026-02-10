# src/cli/
@generated: 2026-02-10T21:26:46Z

## Purpose
The CLI module provides command-line interface functionality for a Debug MCP (Model Context Protocol) server system. It serves as the primary user interface for running MCP servers in various transport modes (stdio, SSE) and analyzing debugging capabilities of compiled binaries.

## Core Architecture

### Command System
The module implements a Commander.js-based CLI with multiple specialized commands:

- **stdio command**: Default mode running MCP server over stdin/stdout transport
- **sse command**: HTTP/SSE transport mode for web-based MCP clients  
- **check-rust-binary command**: Binary analysis for Rust debugging compatibility

### Transport Management
Two primary server transport modes with distinct characteristics:

- **StdioServerTransport**: Direct process communication via stdin/stdout, designed for container environments with keep-alive mechanisms and graceful shutdown handling
- **SSEServerTransport**: HTTP-based Server-Sent Events with shared server instances, session management, and CORS support for web clients

## Key Components

### Core Setup (`setup.ts`)
- `createCLI()`: Factory for Commander.js program instances
- Command setup functions with standardized logging options
- Environment variable coordination (`CONSOLE_OUTPUT_SILENCED`) for transport protection

### Transport Handlers
- **StdioCommandHandler** (`stdio-command.ts`): Process-based transport with containerization support
- **SSECommandHandler** (`sse-command.ts`): HTTP server with session-based connection management

### Infrastructure
- **Error Handlers** (`error-handlers.ts`): Global Node.js error handling with structured logging
- **Version Resolution** (`version.ts`): Cross-environment package.json version detection
- **Commands Directory**: Extensible command implementations for binary analysis

## Public API Surface

### Main Entry Points
- `handleStdioCommand(options: StdioOptions, cmd?: Command)`: stdio transport server
- `handleSSECommand(options: SSEOptions, cmd?: Command)`: HTTP/SSE transport server  
- `handleCheckRustBinaryCommand(binaryPath: string, options?: CheckRustBinaryOptions)`: Binary analysis

### Configuration Interfaces
- `StdioOptions`: Log level and file output control
- `SSEOptions`: Port configuration plus logging options
- `CheckRustBinaryOptions`: JSON output mode for analysis commands

## Internal Organization

### Dependency Injection Pattern
All major components use dependency injection for testability:
- Logger instances (Winston-based)
- Server factory functions
- Process exit handlers
- Optional console output silencing

### Shared Infrastructure
- **Single Shared Server**: SSE mode uses one DebugMcpServer instance across multiple connections
- **Session Management**: Connection tracking with unique session IDs for SSE transport
- **Graceful Shutdown**: Coordinated cleanup across transports, connections, and processes

### Data Flow
1. **CLI Setup**: Commander.js parses arguments and routes to appropriate handler
2. **Transport Initialization**: Handler creates transport-specific server infrastructure
3. **MCP Connection**: Server connects to transport layer for protocol communication
4. **Lifecycle Management**: Keep-alive, error handling, and graceful shutdown coordination

## Key Patterns

### Environment Adaptability
- Cross-module system compatibility (CommonJS/ESM)
- Container-aware lifecycle management with keep-alive mechanisms
- Console output coordination to prevent transport corruption

### Transport Isolation
- Clean separation between stdio and HTTP-based transports
- Protocol-specific error handling and connection management
- Shared server architecture for multi-client SSE scenarios

### Extensible Command Structure
- Plugin-style command handlers with consistent interfaces
- Lazy module loading with user-friendly error messaging
- Dual output modes (human-readable and JSON) for programmatic integration

The module serves as the primary interface layer between users and the Debug MCP server system, providing robust transport options and analysis capabilities while maintaining clean separation of concerns and testable architecture.