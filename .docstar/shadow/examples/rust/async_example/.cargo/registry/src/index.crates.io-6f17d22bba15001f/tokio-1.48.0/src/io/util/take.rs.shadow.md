# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/take.rs
@source-hash: ec6fb4b9fde913b1
@generated: 2026-02-09T18:02:55Z

## Primary Purpose

Implements the `Take` wrapper that limits the number of bytes that can be read from an underlying `AsyncRead` stream. This is a building block for Tokio's async I/O utilities, providing byte-limited reading functionality similar to `std::io::Take` but for async contexts.

## Key Components

### Take Struct (L14-20)
- Wraps any `AsyncRead` type `R` with a byte limit
- Fields:
  - `inner: R` (pinned) - The underlying reader
  - `limit_: u64` - Remaining bytes that can be read (underscore avoids method name conflict)
- Uses `pin_project!` macro for safe pinning projection

### Constructor Function (L22-27)
- `take<R: AsyncRead>(inner: R, limit: u64) -> Take<R>` - Creates new Take instance

### Core Methods (L29-76)
- `limit(&self) -> u64` (L37-39) - Returns remaining byte limit
- `set_limit(&mut self, limit: u64)` (L45-47) - Updates byte limit (resets counter)
- `get_ref(&self) -> &R` (L50-52) - Immutable reference to inner reader
- `get_mut(&mut self) -> &mut R` (L59-61) - Mutable reference with corruption warning
- `get_pin_mut(Pin<&mut Self>) -> Pin<&mut R>` (L68-70) - Pinned mutable reference
- `into_inner(self) -> R` (L73-75) - Consumes wrapper, returns inner reader

## Trait Implementations

### AsyncRead Implementation (L78-105)
- `poll_read()` - Core async reading logic:
  - Returns ready EOF if limit is 0 (L84-86)
  - Creates limited ReadBuf using `buf.take()` (L89)
  - Delegates to inner reader's poll_read (L92)
  - Updates original buffer and decrements limit (L95-103)
  - Uses unsafe `assume_init()` for buffer management (L98-100)

### AsyncBufRead Implementation (L107-128)
- `poll_fill_buf()` (L108-119) - Returns limited view of internal buffer
  - Early return for EOF case (L112-114)
  - Caps returned buffer slice to remaining limit (L117)
- `consume()` (L121-127) - Consumes bytes from buffer
  - Prevents limit reset by capping consume amount (L124)
  - Updates limit and forwards to inner reader

## Dependencies

- **Internal**: `crate::io::{AsyncBufRead, AsyncRead, ReadBuf}` - Core async I/O traits
- **External**: `pin_project_lite` for safe pin projection, standard library for basic types

## Architecture Patterns

- **Wrapper Pattern**: Decorates existing AsyncRead with byte limiting
- **Pin Projection**: Uses pin_project! for safe field access in pinned contexts
- **Delegation**: Forwards operations to inner reader while maintaining limit invariant
- **Defensive Programming**: Guards against limit overflow/underflow in consume operations

## Critical Invariants

- Limit decreases monotonically during reads (never increases except via set_limit)
- Buffer pointer assertions ensure no buffer reallocation during reads (L93)
- Consume operations cannot reset limit by passing large values (L124 guard)
- EOF behavior consistent between AsyncRead and AsyncBufRead implementations