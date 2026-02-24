# src/
@children-hash: 9ef771dee5105741
@generated: 2026-02-24T21:15:32Z

## Debug MCP Server - Complete Source Implementation

The `src` directory contains the complete implementation of a Debug MCP (Model Context Protocol) Server that provides comprehensive debugging capabilities for multiple programming languages through a standardized protocol interface. The system is designed for both interactive and containerized environments, supporting various transport modes and client integration patterns.

## System Architecture Overview

The codebase follows a layered architecture with clear separation of concerns:

**Protocol Layer**: MCP protocol implementation with stdio/SSE transport modes and comprehensive CLI interface
**Session Management Layer**: Debug session lifecycle orchestration with multi-session support and state management  
**Proxy Layer**: DAP (Debug Adapter Protocol) proxy system enabling multi-language debugging through pluggable adapters
**Infrastructure Layer**: Dependency injection, error handling, logging, and cross-environment utilities
**Language Adapter Layer**: Dynamic discovery and loading of language-specific debug adapters

## Key Components Integration

### Core Server (`server.ts` + `index.ts`)
The main `DebugMcpServer` class orchestrates the entire system, providing 18 MCP tools for debug operations including session management, breakpoints, stepping, and variable inspection. The entry point (`index.ts`) handles console silencing for protocol integrity, environment detection, and auto-start functionality with support for both ESM and CJS execution contexts.

### Command Line Interface (`cli/`)
Comprehensive CLI system supporting multiple transport modes:
- **Stdio mode**: Default stdin/stdout communication for MCP protocol
- **SSE mode**: HTTP-based transport with Express server for web clients
- **Binary analysis**: Rust executable analysis utilities
- **Error handling**: Global error handlers with structured logging

### Session Management (`session/`)
Hierarchical session management system built on inheritance pattern:
- `SessionManager` → `SessionManagerOperations` → `SessionManagerData` → `SessionManagerCore`
- Orchestrates complete debug session lifecycle from creation through termination
- Manages DAP communication, state persistence, and debug operations
- Supports multi-session debugging with proper cleanup and resource management

### DAP Proxy System (`proxy/`)
Multi-process proxy architecture enabling language-agnostic debugging:
- **ProxyManager**: Spawns isolated worker processes for each debug session
- **Policy-driven adapters**: Pluggable language-specific debugging behaviors
- **IPC communication**: Robust message protocol with fallback strategies
- **Multi-session support**: Handles complex debugging scenarios like child process spawning

### Adapter Management (`adapters/`)
Dynamic adapter discovery and lifecycle management:
- **AdapterLoader**: Multi-tier resolution strategy for finding adapter packages
- **AdapterRegistry**: Central registry with auto-dispose functionality and instance limits
- **Factory pattern**: Standardized adapter creation with dependency injection

### Infrastructure and Utilities

**Dependency Injection (`container/`)**: Comprehensive DI system with environment-aware initialization and configuration management

**Error System (`errors/`)**: Semantic error hierarchy extending MCP SDK with debugger-specific error classes for structured error handling

**Utilities (`utils/`)**: Cross-environment compatibility, security sanitization, logging infrastructure, and container-aware path resolution

**Implementations (`implementations/`)**: Production-ready concrete implementations of core abstractions, providing Node.js platform integration

## Public API Surface

### Main Entry Points
- **`createDebugMcpServer(options)`**: Factory function for server instantiation
- **CLI Commands**: `stdio` (default), `sse`, `check-rust-binary`
- **MCP Tools**: 18 standardized debugging tools accessible via MCP protocol

### Key Capabilities
- **Multi-language debugging**: Python, JavaScript, Rust, Go, and Mock adapters
- **Transport flexibility**: Stdio and HTTP-based SSE modes
- **Container deployment**: Docker-aware path resolution and environment detection
- **Session management**: Create, manage, and terminate debug sessions
- **Debug operations**: Breakpoints, stepping, variable inspection, expression evaluation
- **Process attachment**: Connect to running processes or launch new debug targets

### Configuration
- **Server options**: Log level, log file configuration
- **Environment variables**: Container mode, workspace root, console output control
- **Language control**: Runtime disable/enable of specific language adapters

## Data Flow and Communication

1. **Initialization**: CLI processes arguments → creates server → sets up transport
2. **Session Creation**: Client request → session manager → proxy manager → language adapter
3. **Debug Operations**: MCP tools → session manager → DAP proxy → debug adapter → target process
4. **Event Handling**: Debug events flow back through proxy → session manager → MCP client
5. **Cleanup**: Graceful shutdown with resource cleanup and process termination

## Cross-Cutting Concerns

**Security**: Comprehensive environment variable sanitization and secure logging practices

**Reliability**: Timeout handling, connection recovery, orphan process detection, and graceful error handling

**Observability**: Structured logging with session correlation, event tracking, and comprehensive error reporting

**Testability**: Dependency injection throughout, mock factories for testing, and clean separation of concerns

**Performance**: LRU caching, efficient state management, and optimized file operations

This implementation provides a robust, production-ready debugging platform that abstracts away the complexity of multi-language debugging while maintaining protocol compatibility and operational reliability across diverse deployment scenarios.