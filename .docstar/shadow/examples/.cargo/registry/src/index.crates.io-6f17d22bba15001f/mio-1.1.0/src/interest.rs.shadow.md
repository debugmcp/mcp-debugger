# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/interest.rs
@source-hash: 1a6975703d866ea6
@generated: 2026-02-09T18:11:36Z

## Purpose
Defines the `Interest` type for the Mio event polling library, representing event readiness types (readable, writable, AIO, LIO, priority) that can be monitored when registering event sources with Poll.

## Core Type
- **Interest (L17)**: Bitflag wrapper around `NonZeroU8` for efficient storage and operations
- Implements Copy, Clone, PartialEq, Eq, PartialOrd, Ord for value semantics

## Constants & Platform Support
- **READABLE (L20, L29)**: Universal read readiness (0b0001)
- **WRITABLE (L21, L32)**: Universal write readiness (0b0010)
- **AIO (L23, L44)**: Async I/O completion on BSD/macOS/iOS platforms
- **LIO (L24, L48)**: List I/O completion (FreeBSD only)
- **PRIORITY (L25, L52)**: Priority events (Linux/Android only)

## Key Methods
- **add() (L68-70)**: Const bitwise OR operation for combining interests
- **remove() (L93-95)**: Removes specific interests, returns None if empty set
- **is_readable/is_writable/is_aio/is_lio/is_priority (L99-125)**: Bitwise tests for specific interests

## Operator Overloads
- **BitOr (L128-135)**: `|` operator delegates to `add()` method
- **BitOrAssign (L137-142)**: `|=` operator for in-place combination

## Debug Implementation (L144-202)
Custom formatter that outputs interests as pipe-separated flags (e.g., "READABLE | WRITABLE"), with platform-conditional formatting for AIO/LIO/PRIORITY.

## Architecture Notes
- Uses `NonZeroU8` for memory optimization (enables Option<Interest> to be same size as Interest)
- Platform-specific features controlled by cfg attributes
- Unsafe code limited to const construction with compile-time verified non-zero values
- All operations maintain the non-zero invariant