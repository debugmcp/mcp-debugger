# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/shutdown.rs
@source-hash: dbf7e47a06b8cc43
@generated: 2026-02-09T18:02:48Z

## Purpose
Provides a future wrapper for gracefully shutting down async I/O writers in the Tokio ecosystem. This utility enables async shutdown operations to be composed with other futures and awaited.

## Key Components

### Shutdown Struct (L10-23)
- **Purpose**: Future wrapper that encapsulates shutdown operations for async writers
- **Fields**:
  - `a: &'a mut A` (L18): Mutable reference to the async writer being shut down
  - `_pin: PhantomPinned` (L21): Makes future `!Unpin` for async trait compatibility
- **Attributes**: `#[must_use]` ensures future is actually polled/awaited
- **Pin Projection**: Uses `pin_project!` macro for safe field access in pinned context

### shutdown Function (L25-34)
- **Purpose**: Factory function creating Shutdown futures
- **Visibility**: `pub(super)` - internal to parent module
- **Constraints**: Requires `AsyncWrite + Unpin + ?Sized` bounds
- **Returns**: `Shutdown<'_, A>` future with borrowed lifetime

### Future Implementation (L36-46)
- **Output**: `io::Result<()>` - standard I/O result for shutdown operations
- **poll Method** (L42-45): Delegates to underlying writer's `poll_shutdown` method via pin projection

## Dependencies
- **External**: `pin_project_lite` for safe pin projection macros
- **Internal**: `crate::io::AsyncWrite` trait for async write operations
- **Standard**: Future/async primitives from `std`

## Architectural Patterns
- **Future Wrapper**: Transforms method calls into composable futures
- **Pin Safety**: Uses pin projection to safely access fields in pinned futures
- **Lifetime Management**: Borrows writer reference rather than taking ownership
- **Trait Delegation**: Directly forwards to underlying `AsyncWrite::poll_shutdown`

## Critical Constraints
- Writer must implement `AsyncWrite + Unpin + ?Sized`
- Future must be pinned due to `PhantomPinned` field
- Lifetime of future tied to lifetime of borrowed writer reference