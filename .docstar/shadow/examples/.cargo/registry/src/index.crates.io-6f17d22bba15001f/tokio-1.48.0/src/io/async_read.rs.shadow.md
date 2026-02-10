# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/async_read.rs
@source-hash: a0f2aa6b2382dd2d
@generated: 2026-02-09T18:06:36Z

**Primary Purpose**: Defines the core `AsyncRead` trait for asynchronous reading operations in Tokio, providing the foundational abstraction for non-blocking byte stream reading with task-based wakeup semantics.

## Core Components

**AsyncRead Trait (L44-60)**: The primary trait defining asynchronous read capabilities
- `poll_read()` method (L55-59): Core polling-based read operation that returns `Poll<io::Result<()>>`
- Takes pinned self, context for wakeup, and mutable `ReadBuf` for output
- Returns `Poll::Ready(Ok(()))` when data is read, `Poll::Pending` when not ready, or error
- Integrates with async task system for automatic wakeup scheduling

## Implementation Patterns

**Deref Macro (L62-72)**: `deref_async_read!` macro for implementing AsyncRead on smart pointer types
- Forwards poll_read calls through deref chain using `Pin::new(&mut **self)`
- Used by Box<T> and &mut T implementations for delegation

**Smart Pointer Implementations**:
- `Box<T>` (L74-76): Uses deref_async_read macro for heap-allocated AsyncRead objects
- `&mut T` (L78-80): Mutable reference wrapper using same deref pattern
- `Pin<P>` (L82-94): Pin-wrapped types using `crate::util::pin_as_deref_mut()` utility

**Concrete Implementations**:
- `&[u8]` (L96-108): Byte slice reader that copies data and advances slice position
  - Uses `split_at()` to partition read data and remainder
  - Always returns Ready since data is immediately available
- `io::Cursor<T>` (L110-133): Positioned reader over AsRef<[u8]> types
  - Maintains internal position, handles bounds checking
  - Protects against position overflow beyond slice length

## Key Dependencies
- `ReadBuf` from parent module for managed buffer operations
- `std::pin::Pin` for memory safety in async contexts  
- `std::task::{Context, Poll}` for async task coordination
- `std::io` for error types and Cursor

## Architectural Decisions
- Uses polling model consistent with Rust async ecosystem
- Requires Pin<&mut Self> to ensure memory safety during async operations
- Separates buffer management into ReadBuf abstraction
- Provides blanket implementations for common smart pointer patterns
- Task-based wakeup system prevents blocking threads

## Critical Invariants
- poll_read must only be called within async task context (may panic otherwise)
- ReadBuf manages filled vs unfilled portions - implementors use put_slice()
- Zero-length reads indicate EOF or zero remaining buffer capacity
- Pending results must arrange for proper task wakeup via Context