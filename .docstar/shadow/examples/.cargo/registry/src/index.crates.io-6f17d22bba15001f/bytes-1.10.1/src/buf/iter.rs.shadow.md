# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/buf/iter.rs
@source-hash: d4dca5b7f9b1cb44
@generated: 2026-02-09T18:06:18Z

## Purpose
Provides a byte-by-byte iterator wrapper for any type implementing the `Buf` trait. This module enables consuming buffer contents through standard Rust iterator patterns.

## Key Components

### IntoIter<T> struct (L20-23)
Generic iterator wrapper that holds an inner buffer of type `T`. The type parameter `T` must implement the `Buf` trait to be used as an iterator.

**Core Methods:**
- `new(inner: T) -> IntoIter<T>` (L41-43): Constructor that wraps a buffer
- `into_inner(self) -> T` (L60-62): Consumes iterator and returns wrapped buffer
- `get_ref(&self) -> &T` (L80-82): Immutable reference to inner buffer
- `get_mut(&mut self) -> &mut T` (L102-104): Mutable reference to inner buffer

### Iterator Implementation (L107-125)
Implements `Iterator` trait for `IntoIter<T: Buf>`:
- `Item = u8`: Yields individual bytes
- `next()` (L110-119): Advances buffer by 1 byte, returns first byte of current chunk or None if empty
- `size_hint()` (L121-124): Returns exact remaining byte count as both lower and upper bounds

### ExactSizeIterator Implementation (L127)
Empty implementation leveraging the exact size hint from the Iterator implementation.

## Dependencies
- `crate::Buf`: Core buffer trait providing `has_remaining()`, `chunk()`, `advance()`, and `remaining()` methods

## Key Patterns
- **Wrapper Pattern**: IntoIter wraps any Buf-implementing type to provide iterator functionality
- **Exact Size Iterator**: Leverages buffer's known size for optimal iterator performance
- **Zero-copy Access**: Uses `chunk()[0]` to read bytes without additional allocations

## Implementation Details
The iterator advances the underlying buffer position by 1 byte per iteration, making it a consuming operation that modifies the wrapped buffer's state. The `get_ref()` and `get_mut()` methods allow access to the underlying buffer but come with warnings against direct reading to avoid iterator state corruption.