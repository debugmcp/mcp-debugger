# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/windows/
@generated: 2026-02-09T18:16:06Z

## Purpose

This directory contains Tokio's Windows-specific networking implementations, providing async I/O capabilities for Windows-only network primitives. It serves as the platform-specific networking layer within Tokio's broader cross-platform networking architecture.

## Architecture

The module uses a two-level organization:
- **mod.rs**: Acts as the Windows networking namespace, exposing platform-specific functionality through conditional compilation
- **named_pipe.rs**: Implements the complete Windows Named Pipes async I/O system

## Key Components

### Named Pipes Implementation
The primary component is a comprehensive Windows Named Pipes implementation providing:

**Server-side API (`NamedPipeServer`)**:
- Connection lifecycle: `connect()`, `disconnect()`
- Configuration via `ServerOptions` builder with extensive security and performance options
- Bidirectional async I/O with full Tokio integration

**Client-side API (`NamedPipeClient`)**:
- Symmetric I/O interface matching server capabilities
- Configuration via `ClientOptions` with access control and security settings

**Unified I/O Interface**:
Both server and client implement identical async I/O patterns:
- `AsyncRead`/`AsyncWrite` traits for streaming operations
- Non-blocking methods: `try_read()`, `try_write()` with vectorized variants
- Readiness detection: `ready()`, `readable()`, `writable()`
- Custom I/O operations: `try_io()`, `async_io()`

## Public API Surface

### Main Entry Points
- `NamedPipeServer`: Server-side named pipe endpoint
- `NamedPipeClient`: Client-side named pipe endpoint  
- `ServerOptions`: Builder for server configuration
- `ClientOptions`: Builder for client configuration

### Supporting Types
- `PipeMode`: Communication mode (byte stream vs message-based)
- `PipeEnd`: Endpoint type identification
- `PipeInfo`: Pipe metadata and capabilities

## Internal Organization

The implementation follows Tokio's async I/O patterns by wrapping `mio_windows::NamedPipe` primitives with `PollEvented` for reactor integration. Platform isolation is achieved through conditional compilation, keeping Windows-specific code separate from portable networking implementations.

## Data Flow

Named pipe operations flow through:
1. Builder pattern configuration (`ServerOptions`/`ClientOptions`)
2. Pipe creation using Windows API calls (`CreateNamedPipeW`/`CreateFileW`)
3. Tokio reactor integration via `PollEvented` wrapper
4. Async I/O operations through standard Tokio traits

## Important Patterns

- **Platform Isolation**: Conditional compilation ensures Windows-specific code doesn't interfere with cross-platform builds
- **Symmetric API**: Server and client expose identical I/O interfaces for consistent programming model
- **Builder Pattern**: Extensive configuration options handled through type-safe builders
- **Windows Integration**: Deep integration with Windows security model and error handling patterns