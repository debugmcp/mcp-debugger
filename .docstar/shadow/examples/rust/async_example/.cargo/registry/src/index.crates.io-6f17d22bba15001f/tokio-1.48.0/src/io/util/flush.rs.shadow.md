# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/flush.rs
@source-hash: e3384731406fbbfd
@generated: 2026-02-09T18:02:45Z

## Purpose
Provides a future wrapper for asynchronously flushing I/O objects, ensuring all buffered data is written before completion.

## Key Components

### Flush<'a, A> struct (L18-23)
- Future wrapper that holds a mutable reference to an AsyncWrite object
- Uses `pin_project!` macro for safe pinning with `PhantomPinned` field
- Lifetime parameter `'a` ties the future to the borrowed writer's lifetime
- Marked with `#[must_use]` to prevent accidental dropping without polling

### flush() factory function (L27-35)
- Creates `Flush` future instances from mutable AsyncWrite references
- Requires `AsyncWrite + Unpin + ?Sized` bounds
- Returns `Flush<'_, A>` with inferred lifetime
- Package-private visibility (`pub(super)`)

### Future implementation (L37-47)
- Implements `Future` trait with `io::Result<()>` output
- `poll()` method (L43-46) delegates directly to the wrapped object's `poll_flush()`
- Uses `pin_project` to safely access the pinned writer reference

## Dependencies
- `pin_project_lite` for safe pinning without unsafe code
- `crate::io::AsyncWrite` trait for async write operations
- Standard library futures and I/O types

## Architectural Patterns
- **Future wrapper pattern**: Encapsulates flush operation as a pollable future
- **Zero-cost abstraction**: Direct delegation to underlying `poll_flush()` with minimal overhead
- **Pinning safety**: Uses `PhantomPinned` to maintain compatibility with async trait methods

## Usage Context
Part of Tokio's I/O utilities, typically consumed through `AsyncWriteExt::flush()` extension method rather than directly.