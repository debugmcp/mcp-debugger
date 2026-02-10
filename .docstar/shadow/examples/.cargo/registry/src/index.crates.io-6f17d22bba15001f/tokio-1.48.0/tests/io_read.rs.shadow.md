# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_read.rs
@source-hash: c0ed5738a4b2d962
@generated: 2026-02-09T18:12:18Z

## Tokio AsyncRead Trait Test Suite

**Purpose:** Comprehensive test file for Tokio's `AsyncRead` trait implementation, focusing on correct buffer handling and testing edge cases that should panic.

**Key Components:**

### Test Functions
- `read()` (L16-43): Basic AsyncRead functionality test using a simple mock reader
- `read_buf_bad_async_read()` (L70-75): Panic test for improper AsyncRead implementation that violates buffer safety

### Test Implementations

#### `Rd` struct (L18-35)
- Simple AsyncRead mock that returns "hello world" 
- Tracks poll count to ensure single-call behavior (L20, L29)
- Implements proper `poll_read` using `ReadBuf::put_slice()` (L32)

#### `BadAsyncRead` struct (L45-68)
- Malicious AsyncRead implementation designed to violate buffer safety
- Uses `LeakedBuffers` helper to create memory leaks (L46, L52)
- Illegally replaces the provided ReadBuf with unsafe leaked memory (L63)
- Advances buffer to full capacity without proper initialization (L64)

**Dependencies:**
- `tokio::io::{AsyncRead, AsyncReadExt, ReadBuf}` - Core async I/O traits
- `tokio_test::assert_ok` - Test utilities
- `support::leaked_buffers::LeakedBuffers` - Buffer leak testing helper (L14)

**Architecture Pattern:**
Uses trait implementation testing pattern with both compliant and non-compliant implementations to verify correct behavior and panic conditions.

**Critical Invariants:**
- ReadBuf must not be replaced with different memory (violated in BadAsyncRead L63)
- Buffer advancement must match actual data written
- AsyncRead implementations should be called exactly once for simple reads (verified L29)