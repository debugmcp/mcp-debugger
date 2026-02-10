# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/waker.rs
@source-hash: cf27f75061b86dab
@generated: 2026-02-09T18:02:27Z

## Purpose
Windows-specific waker implementation for the mio event loop library. Provides a mechanism to wake up a selector from another thread by posting completion events to an I/O Completion Port (IOCP).

## Key Components

### Waker Struct (L9-13)
- **token**: `Token` - Unique identifier for this waker instance
- **port**: `Arc<CompletionPort>` - Shared reference to the IOCP for cross-thread wake notifications

### Core Methods

#### new() (L16-21)
Constructor that creates a waker instance associated with a selector:
- Takes a `Selector` reference and `Token` for identification
- Clones the selector's completion port for shared access
- Returns `io::Result<Waker>` for error handling

#### wake() (L23-28)
Thread-safe wake mechanism:
- Creates a new `Event` with the waker's token
- Sets the event as readable to signal availability
- Posts the event to the completion port as a completion status
- Returns `io::Result<()>` to propagate IOCP posting errors

## Dependencies
- Uses Windows-specific `Event`, `Selector`, and `CompletionPort` from parent modules
- Relies on `Token` from crate root for event identification
- Uses `Arc` for thread-safe sharing of the completion port

## Architectural Notes
- Implements the waker pattern for async I/O event loops on Windows
- Leverages Windows IOCP for efficient cross-thread notification
- Part of mio's platform-specific abstraction layer
- Design allows multiple threads to wake the same selector safely