# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/write_all_buf.rs
@source-hash: a64e5d666fcdc4c2
@generated: 2026-02-09T18:02:50Z

## Purpose
Provides asynchronous buffer writing functionality for Tokio's IO utilities. Implements a future that writes the entire contents of a buffer to an AsyncWrite target, handling both regular and vectored writes.

## Key Components

**WriteAllBuf struct (L15-20)**: A pinned future that holds mutable references to a writer and buffer. Uses `PhantomPinned` to prevent movement after creation, ensuring memory safety for the borrowed references.

**write_all_buf function (L25-35)**: Constructor function that creates a WriteAllBuf future. Requires writer to implement `AsyncWrite + Unpin` and buffer to implement `Buf` trait.

**Future implementation (L37-64)**: Core polling logic that:
- Checks vectored write support via `is_write_vectored()` (L49)
- For vectored writes: uses up to 64 IoSlice elements, calls `poll_write_vectored` (L50-52)
- For regular writes: calls `poll_write` with buffer chunk (L54)
- Advances buffer by bytes written and handles zero-write error condition (L56-59)
- Continues until buffer is fully consumed (L48)

## Dependencies
- `bytes::Buf` for buffer abstraction
- `pin_project_lite` for safe field projection in pinned structs
- Tokio's `AsyncWrite` trait for async writing interface

## Architecture Patterns
- Future-based async design with manual Poll implementation
- Pin projection for safe field access in self-referential struct
- Vectored IO optimization when supported by writer
- Zero-copy buffer advancement using Buf trait

## Critical Invariants
- Buffer must be fully consumed before returning success
- Zero-byte writes trigger WriteZero error (L57-59)
- Writer references must remain valid for future lifetime
- MAX_VECTOR_ELEMENTS constant limits vectored write slice count to 64