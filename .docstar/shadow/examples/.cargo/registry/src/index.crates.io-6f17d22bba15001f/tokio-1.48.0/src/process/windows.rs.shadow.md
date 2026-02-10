# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/process/windows.rs
@source-hash: c831ca17a7704133
@generated: 2026-02-09T18:06:45Z

## Windows Asynchronous Process Management

Implements Windows-specific asynchronous process handling for Tokio using Win32 APIs. Since Windows lacks native IOCP integration for process monitoring, this module uses `RegisterWaitForSingleObject` to receive process exit notifications through kernel32's thread pool.

### Core Architecture

**Child (L44-47)**: Main async process wrapper containing a `StdChild` and optional `Waiting` state. Implements `Future` to async await process completion, `Kill` for termination, and standard process operations.

**Waiting (L59-63)**: Process wait state containing oneshot channel receiver, Win32 wait object handle, and raw pointer to sender. Manages the async notification mechanism when process exits.

**ChildStdio (L189-194)**: Async stdio wrapper with dual file representations - `raw` Arc for handle access and `io` Blocking wrapper for async operations. Implements AsyncRead/AsyncWrite traits.

### Key Functions

**build_child (L68-82)**: Factory function converting std::process::Child to SpawnedChild with async stdio streams.

**Child::poll (L103-144)**: Core Future implementation with two-phase logic:
1. Check existing wait state via oneshot receiver
2. Try non-blocking wait, fallback to RegisterWaitForSingleObject + oneshot setup

**callback (L164-167)**: Win32 callback function triggered on process exit, signals completion through oneshot sender.

**stdio (L236-249)**: Converts raw handle to ChildStdio with Arc-wrapped file and Blocking async wrapper.

### Win32 Integration

Uses `RegisterWaitForSingleObject` (L123-131) with `WT_EXECUTEINWAITTHREAD | WT_EXECUTEONLYONCE` flags for one-shot process monitoring. Cleanup handled in `Waiting::drop` (L152-162) via `UnregisterWaitEx`.

**ArcFile (L170-186)**: Thread-safe file wrapper enabling shared access to stdio handles across async contexts.

### Safety Considerations

- Raw pointer management for Win32 callback context (L120, L165)
- Unsafe trait implementations for Waiting (L65-66) 
- Handle duplication for stdio conversion (L262-285)
- Proper cleanup of Win32 wait objects to prevent resource leaks