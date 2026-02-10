# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/
@generated: 2026-02-09T18:16:15Z

## Overview

This directory implements the Windows-specific system layer for the Mio async I/O library. It provides a complete abstraction over Windows' I/O Completion Ports (IOCP) and Auxiliary Function Driver (AFD) to deliver efficient, edge-triggered event notification for sockets and named pipes on Windows platforms.

## Core Architecture

The implementation bridges two Windows async I/O models:
- **IOCP (I/O Completion Ports)**: High-performance completion-based I/O for general file handles
- **AFD (Auxiliary Function Driver)**: Low-level socket polling mechanism accessed via NT API

The system simulates edge-triggered semantics on top of Windows' naturally level-triggered APIs through careful state management and event clearing.

## Key Components and Data Flow

### Event Processing Pipeline
1. **Event** (`event.rs`) - Core event representation using AFD poll flags
2. **Events** collection - Batch container converting raw IOCP completions to Mio events
3. **Selector** (`selector.rs`) - Main event loop coordinator managing socket states and polling

### Socket Management Hierarchy
- **SelectorInner**: Core implementation with IOCP, AFD group management, and update queues
- **AfdGroup**: Pool of AFD handles (max 32 sockets per handle) for efficient resource usage
- **SockState**: Individual socket state machine (Idle → Pending → Processing) with reference-counted lifetime management
- **IoSourceState** (`mod.rs`): Public wrapper managing registration lifecycle

### Windows Resource Abstractions
- **Handle** (`handle.rs`): RAII wrapper for Windows HANDLEs with automatic cleanup
- **CompletionPort** (`iocp.rs`): Thread-safe IOCP wrapper with bulk event dequeuing
- **IoStatusBlock**: Safe wrapper for Win32 IO_STATUS_BLOCK structures
- **Overlapped** (`overlapped.rs`): Callback-enabled overlapped I/O structure wrapper

## Public API Surface

### Primary Entry Points
- **Selector::new()**: Creates Windows event selector with unique ID
- **Selector::select()**: Main polling loop with timeout support
- **Selector::register()/reregister()**: Socket registration with interest specification
- **IoSourceState**: Manages I/O source lifecycle (register → reregister → deregister)

### Network Abstractions
- **TCP** (`tcp.rs`): Non-blocking TCP socket operations (bind, connect, listen, accept)
- **UDP** (`udp.rs`): UDP socket creation and IPv6-only detection
- **NamedPipe** (`named_pipe.rs`): Full-featured named pipe implementation with internal buffering
- **Network utilities** (`net.rs`): Socket creation, WinSock initialization, address conversion

### Cross-thread Coordination
- **Waker** (`waker.rs`): Thread-safe selector wake mechanism via IOCP event posting

## Internal Organization

### Memory Management Patterns
- **Reference Counting**: `Pin<Arc<Mutex<SockState>>>` for kernel memory lifetime safety
- **RAII Cleanup**: Automatic resource disposal through Drop traits
- **Unsafe FFI Bridges**: Controlled unsafe blocks for Windows API integration

### Concurrency Model
- **Single-threaded Polling**: Atomic guards prevent concurrent selector operations
- **Thread-safe Waking**: Cross-thread notification via shared IOCP handles
- **Deferred Updates**: Update queues batch socket state changes during polling

### Error Handling
- **syscall! Macro**: Consistent Windows API error translation to `io::Result`
- **Comprehensive Cleanup**: Error paths ensure proper resource disposal
- **Platform Error Mapping**: Windows-specific error codes mapped to standard I/O errors

## Critical Design Constraints

1. **Edge-Trigger Simulation**: Events cleared after delivery, requiring reregistration for continued notification
2. **Socket State Pinning**: Kernel memory references require `Pin<Arc<>>` for safety
3. **AFD Handle Limits**: Maximum 32 sockets per AFD handle with automatic pooling
4. **Single Selector Polling**: Atomic flags prevent concurrent polling operations
5. **Reference Count Management**: Manual Arc manipulation for async operation lifetime safety

This directory provides the complete Windows implementation foundation for Mio's cross-platform async I/O abstraction, handling all platform-specific complexities while presenting a consistent interface to higher-level code.