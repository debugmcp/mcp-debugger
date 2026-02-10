# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/async_seek.rs
@source-hash: 6b00824bd018acb1
@generated: 2026-02-09T18:06:32Z

This file defines the core `AsyncSeek` trait for asynchronous seeking operations in Tokio's I/O system, providing non-blocking alternatives to `std::io::Seek`.

## Core Trait
**`AsyncSeek` (L18-53)**: Primary trait for asynchronous seeking operations with two required methods:
- `start_seek(self: Pin<&mut Self>, position: SeekFrom) -> io::Result<()>` (L33): Initiates a seek operation without blocking, returning immediately after submission
- `poll_complete(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<u64>>` (L52): Polls for completion of the seek operation, returning the final position when ready

## Key Implementation Pattern
**`deref_async_seek!` macro (L55-65)**: Code generation macro that implements `AsyncSeek` for pointer-like types by delegating to the pointed-to implementation. Used for automatic trait forwarding through smart pointers.

## Standard Library Integrations
- **`Box<T>` impl (L67-69)**: Enables seeking through boxed async seekers
- **`&mut T` impl (L71-73)**: Enables seeking through mutable references
- **`Pin<P>` impl (L75-87)**: Handles pinned pointer types using `crate::util::pin_as_deref_mut`
- **`io::Cursor<T>` impl (L89-96)**: Synchronous implementation for in-memory cursors that completes immediately

## Architecture Notes
- Split-phase design: `start_seek` + `poll_complete` enables non-blocking operation
- Pin-based API ensures memory safety for self-referential async types
- Error handling: `start_seek` can return `io::ErrorKind::Other` if another seek is in progress
- Position tracking: `poll_complete` position is only reliable immediately after `start_seek`

## Dependencies
- `std::io::{self, SeekFrom}` for standard I/O types
- `std::ops::DerefMut` for pointer dereferencing  
- `std::pin::Pin` and `std::task::{Context, Poll}` for async infrastructure
- `crate::util::pin_as_deref_mut` for internal pin utilities