# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/ready.rs
@source-hash: 85fc7a192552607a
@generated: 2026-02-09T18:06:38Z

## Purpose
Defines `Ready` struct representing I/O readiness states for Tokio's async runtime. Tracks which operations (read, write, close, error, priority) an I/O resource is ready to perform using bitflag patterns.

## Core Structure
- **Ready (L21)**: Bitflag wrapper around `usize` representing I/O readiness states
- Uses const bitflag values: `READABLE` (0b01), `WRITABLE` (0b10), `READ_CLOSED` (0b0100), `WRITE_CLOSED` (0b1000), `PRIORITY` (0b10000, Linux/Android only), `ERROR` (0b100000)

## Key Constants (L25-54)
- `EMPTY`: Empty readiness set
- `READABLE/WRITABLE/READ_CLOSED/WRITE_CLOSED/ERROR`: Individual readiness states
- `PRIORITY`: Linux/Android-specific priority readiness
- `ALL`: Combined readiness for all operations (platform-dependent)

## Critical Methods

### Conversion & Integration
- **from_mio() (L57-99)**: Converts Mio events to Ready states, handles platform-specific features (FreeBSD AIO/LIO, Linux/Android priority)
- **from_interest() (L238-262)**: Converts Interest to Ready, automatically includes closed states for read/write interests
- **from_usize()/as_usize() (L226-236)**: Atomic operations support for concurrent access

### State Inspection (L111-207)
- **is_readable() (L127-129)**: Returns true for READABLE or READ_CLOSED states
- **is_writable() (L143-145)**: Returns true for WRITABLE or WRITE_CLOSED states
- **is_read_closed()/is_write_closed()**: Direct closed state checks
- **is_priority()** (Linux/Android): Priority readiness check
- **is_error()**: Error condition check

### Operations
- **contains() (L214-217)**: Subset relationship check
- **intersection() (L264-266)**: Bitwise intersection with Interest
- **satisfies() (L268-270)**: Checks if readiness satisfies given Interest

## Trait Implementations (L273-321)
- **BitOr/BitOrAssign**: Combining readiness states
- **BitAnd**: Intersection operations  
- **Sub**: Removing readiness states (bitwise AND with complement)
- **Debug**: Structured debug output showing all readiness flags

## Dependencies
- `crate::io::interest::Interest`: Interest type for I/O operation desires
- `mio::event::Event`: Mio event integration for epoll/kqueue events

## Platform Specifics
- Linux/Android: Supports `PRIORITY` readiness for priority data
- FreeBSD: Special handling for AIO and LIO events in `from_mio()`
- Conditional compilation ensures appropriate feature availability

## Architectural Notes
- Bitflag design enables efficient set operations and atomic storage
- Ready represents "what can be done now" vs Interest representing "what we want to do"
- Integration with Mio provides cross-platform event loop compatibility
- Closed states are considered readable/writable for EOF handling