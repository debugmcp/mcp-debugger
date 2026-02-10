# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/memchr.rs
@source-hash: 8cb5e0a0da9b7d94
@generated: 2026-02-09T18:06:50Z

## Purpose
Provides byte searching functionality in byte arrays with conditional libc optimization. Acts as a utility module within Tokio's internal infrastructure, offering platform-optimized byte search with fallback implementation.

## Key Functions

### `memchr` (L7-9 & L12-23)
**Signature**: `fn memchr(needle: u8, haystack: &[u8]) -> Option<usize>`

Two conditional implementations based on compilation target:
- **Fallback version** (L7-9): Uses iterator-based search when libc unavailable or on non-Unix platforms
- **Optimized version** (L12-23): Leverages libc's native `memchr` function on Unix systems with libc feature enabled

Returns `Some(index)` if needle found, `None` otherwise. Index represents byte position from start of haystack.

## Dependencies
- `libc` crate (conditional): Used for optimized Unix implementation
- Standard library iterators for fallback

## Architecture Decisions
- **Conditional compilation**: Uses `#[cfg]` attributes to select implementation based on platform (Unix) and feature flags (libc)
- **Unsafe optimization**: Unix version uses unsafe libc call with explicit safety documentation (L15-16)
- **Pointer arithmetic**: Calculates result index by subtracting pointer addresses (L21)

## Implementation Details
- **Fallback method**: Simple linear search using iterator position finding
- **Optimized method**: Direct libc call with proper null pointer checking
- **Safety invariant**: Ensures haystack pointer validity for its length before unsafe libc call

## Test Coverage (L25-74)
Comprehensive test suite includes:
- **Basic functionality** (L30-51): Tests various byte values including special characters, null bytes, and non-ASCII
- **Exhaustive testing** (L54-66): Validates all possible byte values (0-255) in forward and reverse arrays
- **Edge cases** (L69-73): Verifies behavior with empty arrays

## Critical Constraints
- Unix platform requirement for libc optimization
- Feature gate dependency on "libc" feature flag
- Memory safety relies on proper haystack slice validity