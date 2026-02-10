# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/asyncio/
@generated: 2026-02-09T18:16:04Z

## Purpose
This directory contains asyncio's subprocess handling functionality, providing asynchronous process execution and communication capabilities. It enables Python applications to create and manage subprocesses with non-blocking I/O operations, integrating seamlessly with asyncio's event loop architecture.

## Key Components & Organization
The module is structured around a three-layer architecture:

### High-Level API Layer
- **Factory Functions**: `create_subprocess_exec()` and `create_subprocess_shell()` serve as the primary entry points for creating subprocess instances
- **Process Class**: High-level wrapper providing async methods for process control (terminate, kill, send_signal) and communication (communicate method for full I/O interaction)

### Protocol Layer  
- **SubprocessStreamProtocol**: Core implementation of asyncio's SubprocessProtocol interface that handles low-level subprocess events and creates stream interfaces for pipes

### Stream Integration
- Seamless integration with asyncio's StreamReader/StreamWriter classes for stdin/stdout/stderr communication
- Automatic stream lifecycle management with proper EOF handling and exception propagation

## Public API Surface
**Main Entry Points:**
- `create_subprocess_exec(program, *args, **kwargs)` - Execute program with arguments
- `create_subprocess_shell(cmd, **kwargs)` - Execute shell command string
- `PIPE`, `STDOUT`, `DEVNULL` constants (re-exported from subprocess module)

**Process Interface:**
- `.stdin`, `.stdout`, `.stderr` - Stream objects for I/O
- `.pid`, `.returncode` - Process identification and status
- `.communicate(input=None)` - Send input and read all output
- `.terminate()`, `.kill()`, `.send_signal()` - Process control methods

## Internal Data Flow
1. Factory functions create SubprocessStreamProtocol instance
2. Protocol integrates with event loop's subprocess_exec/subprocess_shell methods
3. Transport/protocol connection established with automatic stream creation for available pipes
4. Process wrapper provides async interface over protocol/transport layer
5. Stream operations handle data routing (fd 1→stdout, fd 2→stderr) 
6. Automatic cleanup when all pipes close and process exits

## Key Patterns & Conventions
- **Transport/Protocol Pattern**: Uses asyncio's standard transport/protocol architecture for subprocess management
- **Stream-Based I/O**: All subprocess communication uses StreamReader/StreamWriter for consistent async interface
- **Graceful Error Handling**: Communication methods ignore expected errors like BrokenPipeError and ConnectionResetError
- **Debug Integration**: Comprehensive debug logging when event loop debugging is enabled
- **Resource Management**: Automatic transport closure when subprocess exits and all pipes are closed

This module provides the essential infrastructure for asynchronous subprocess operations within the broader asyncio ecosystem, handling the complexity of process lifecycle management while exposing a clean, stream-based API for application developers.