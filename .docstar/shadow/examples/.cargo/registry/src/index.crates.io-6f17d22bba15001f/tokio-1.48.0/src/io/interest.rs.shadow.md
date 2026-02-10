# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/interest.rs
@source-hash: a359b014993e626f
@generated: 2026-02-09T18:06:41Z

## Primary Purpose

Defines the `Interest` type for specifying I/O readiness event interests in Tokio's async I/O system. This is a bitfield-based wrapper around platform-specific I/O interest flags that provides a unified interface for specifying what types of events (readable, writable, error, etc.) an async operation should wait for.

## Key Structure

**Interest struct (L28-29)**: Core type wrapping a `usize` bitfield that represents combinations of I/O readiness interests. Provides platform-agnostic constants and methods for I/O event registration.

## Platform-Specific Constants

- `READABLE`, `WRITABLE` (L10-11): Universal read/write interests 
- `AIO`, `LIO` (L14, L16): FreeBSD-specific POSIX AIO interests
- `PRIORITY` (L18): Linux/Android priority event interest
- `ERROR` (L21): Cross-platform error interest (behavior varies by OS)

## Key Methods

**Interest constants (L34-71)**: Platform-conditional const definitions for different interest types, with FreeBSD getting real AIO/LIO values and other platforms falling back to READABLE.

**Interest checking methods (L86-151)**:
- `is_readable()` (L86-88): Checks READABLE bit
- `is_writable()` (L103-105): Checks WRITABLE bit  
- `is_error()` (L120-122): Checks ERROR bit
- `is_priority()` (L149-151): Linux/Android only, checks PRIORITY bit
- `is_aio()`, `is_lio()` (L125-132): FreeBSD-only, private AIO checks

**Interest manipulation**:
- `add()` (L167-169): Const-compatible bitwise OR for combining interests
- `remove()` (L195-203): Bitwise removal with None return for empty result

**Conversion methods**:
- `to_mio()` (L206-256): Converts to mio::Interest, handling platform differences and empty interest edge cases
- `mask()` (L258-267): Maps Interest to Ready event masks

## Trait Implementations

**BitOr/BitOrAssign (L270-284)**: Enables `|` operator for combining interests via `add()` method.

**Debug (L286-344)**: Custom formatter showing human-readable interest combinations (e.g., "READABLE | WRITABLE").

## Important Dependencies

- `crate::io::ready::Ready`: Target type for interest-to-readiness mapping
- `mio::Interest`: Underlying I/O library interest type for actual event registration

## Architectural Decisions

- Uses bitfield pattern for efficient interest combination and checking
- Platform-conditional compilation ensures optimal platform support
- Fallback strategy for unsupported platforms (AIO/LIO → READABLE)
- Error interest requires special handling since mio doesn't have direct equivalent
- Private `to_mio()` method hides mio dependency from public API