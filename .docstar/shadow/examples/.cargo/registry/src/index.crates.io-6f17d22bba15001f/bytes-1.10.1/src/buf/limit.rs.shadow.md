# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/buf/limit.rs
@source-hash: e005ba140b70f686
@generated: 2026-02-09T18:06:16Z

## Purpose
Provides a `BufMut` adapter that enforces write limits on underlying buffers, preventing writes beyond a specified byte threshold.

## Key Components

### Limit<T> struct (L9-12)
Generic wrapper that constrains write operations to an underlying `BufMut` implementation:
- `inner: T` - The wrapped buffer
- `limit: usize` - Maximum bytes that can be written

### Constructor
- `new<T>()` (L14-16) - Package-private constructor creating a new Limit instance

### Access Methods
- `into_inner()` (L20-22) - Consumes wrapper, returns underlying buffer
- `get_ref()` (L27-29) - Immutable reference to inner buffer
- `get_mut()` (L34-36) - Mutable reference to inner buffer (bypasses limit enforcement)
- `limit()` (L44-46) - Returns current write limit
- `set_limit()` (L54-56) - Updates the write limit

### BufMut Implementation (L59-75)
Implements the core `BufMut` trait with limit enforcement:
- `remaining_mut()` (L60-62) - Returns minimum of inner buffer capacity and current limit
- `chunk_mut()` (L64-68) - Returns mutable slice truncated to respect limit
- `advance_mut()` (L70-74) - Advances write position and decrements remaining limit

## Key Behaviors
- Write operations are constrained by the smaller of: inner buffer capacity or configured limit
- Limit decreases as bytes are written via `advance_mut()`
- Direct access to inner buffer via `get_mut()` bypasses limit enforcement (documented as inadvisable)
- Uses `unsafe` implementation due to `BufMut` trait requirements for memory safety

## Dependencies
- `crate::buf::UninitSlice` - Uninitialized memory slice type
- `crate::BufMut` - Core mutable buffer trait
- `core::cmp::min` - Standard library minimum function