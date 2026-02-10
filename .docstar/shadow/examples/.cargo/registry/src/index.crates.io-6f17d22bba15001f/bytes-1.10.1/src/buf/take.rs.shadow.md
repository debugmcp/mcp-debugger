# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/buf/take.rs
@source-hash: 68053cf0edd9e1ab
@generated: 2026-02-09T18:06:20Z

## Purpose
Implements `Take<T>`, a buffer adapter that limits the number of bytes read from an underlying buffer to a specified maximum. This is a wrapper type that enforces read limits while delegating to the wrapped buffer implementation.

## Core Structure
- **Take<T> struct (L13-16)**: Generic wrapper containing `inner: T` buffer and `limit: usize` counter
- **new() constructor (L18-20)**: Factory function creating Take instances

## Key Methods
- **into_inner() (L42-44)**: Consumes Take and returns wrapped buffer
- **get_ref()/get_mut() (L59-61, L80-82)**: Access underlying buffer (with warnings about direct use)
- **limit() (L102-104)**: Returns current remaining read limit
- **set_limit() (L130-132)**: Updates the read limit

## Buf Implementation (L135-203)
Critical buffer trait implementation that enforces limits:
- **remaining() (L136-138)**: Returns min(inner.remaining(), limit) - prevents reading beyond limit
- **chunk() (L140-143)**: Returns slice truncated to limit size
- **advance() (L145-149)**: Advances inner buffer and decrements limit (with assertion)
- **copy_to_bytes() (L151-157)**: Copies data while updating limit
- **chunks_vectored() (L160-203)**: Complex vectored I/O implementation with limit enforcement

## Dependencies
- `crate::Buf` trait for buffer operations
- `core::cmp` for min() operations  
- `std::io::IoSlice` (std feature only) for vectored I/O

## Key Patterns
- **Limit Enforcement**: All read operations respect the limit field, preventing over-reading
- **Delegation Pattern**: Wraps another Buf implementation while adding limit logic
- **Unsafe Transmutation (L192, L197)**: Uses unsafe code for lifetime extension in vectored operations due to MSRV constraints
- **State Tracking**: Limit decreases as bytes are consumed, maintaining read budget

## Critical Invariants
- Limit must never be exceeded (enforced by assertions in advance())
- Inner buffer operations must be synchronized with limit updates
- Vectored operations must respect limit across multiple slices