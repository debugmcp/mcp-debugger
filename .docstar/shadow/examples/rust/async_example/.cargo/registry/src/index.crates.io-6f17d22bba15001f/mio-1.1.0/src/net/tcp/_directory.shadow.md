# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/net/tcp/
@generated: 2026-02-09T18:16:08Z

## Overview
This directory implements the TCP networking layer for Mio's async I/O framework. It provides cross-platform, non-blocking TCP client and server capabilities through event-driven I/O operations, serving as the core TCP abstraction for building scalable network applications.

## Module Organization
The directory follows a clean three-file structure:
- **mod.rs**: Public API aggregator that re-exports the main TCP types
- **listener.rs**: TCP server socket implementation (`TcpListener`)  
- **stream.rs**: TCP client socket implementation (`TcpStream`)

## Public API Surface
The module exposes two primary entry points:

### TcpListener
- **`TcpListener::bind(addr)`**: Creates a non-blocking TCP server socket
- **`accept()`**: Non-blocking client connection acceptance
- **Event-driven**: Integrates with Mio's polling system for scalable server architectures

### TcpStream  
- **`TcpStream::connect(addr)`**: Initiates non-blocking TCP client connection
- **Standard I/O traits**: `Read`/`Write` implementations for data transfer
- **Connection management**: Shutdown, error handling, and socket options

## Architecture Patterns
Both components share a common design built around several key abstractions:

### IoSource Wrapper Pattern
Both `TcpListener` and `TcpStream` wrap their respective `std::net` types in an `IoSource<T>` container that:
- Provides platform-agnostic event registration
- Handles proper `WouldBlock` error management
- Ensures correct event loop re-registration

### Cross-Platform Compatibility
Extensive platform-specific implementations handle:
- **Unix/Hermit**: File descriptor-based operations
- **Windows**: Socket handle-based operations  
- **WASI**: Limited subset functionality
- Raw FD/socket conversions for `std` library interoperability

### Event System Integration
Both types implement `event::Source` trait enabling:
- Registration with Mio's `Poll` instance
- Token-based event identification
- Interest specification (readable/writable events)

## Data Flow and Usage Patterns
### Server Flow
1. `TcpListener::bind()` creates non-blocking server socket
2. Register with event loop for readable events
3. `accept()` returns new `TcpStream` connections on events
4. Each accepted stream operates independently in the event loop

### Client Flow  
1. `TcpStream::connect()` initiates non-blocking connection
2. Register for writable events to detect connection completion
3. Complex 6-step handshake validates successful connection
4. Stream ready for standard `Read`/`Write` operations

## Key Implementation Details
- **Socket Options**: Both types support TTL configuration and error retrieval
- **Non-blocking Guarantee**: All I/O operations return immediately with `WouldBlock` when data unavailable
- **Platform Security**: `SO_REUSEADDR` enabled on Unix but disabled on Windows for security
- **WASI Limitations**: Reduced functionality on WebAssembly System Interface targets
- **I/O Safety**: Proper raw FD/socket lifecycle management with modern Rust safety patterns

## Dependencies
- **Core Mio**: `IoSource`, `Registry`, `Token`, `Interest`, `event::Source`
- **Platform Layer**: `crate::sys::tcp` for low-level socket operations
- **Standard Library**: Network types and platform-specific I/O traits

This module serves as the foundation for all TCP networking in Mio applications, providing the building blocks for both client and server architectures in async, event-driven systems.