# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/duplex_stream.rs
@source-hash: 680a6052e9a7ab6c
@generated: 2026-02-09T18:12:08Z

## Purpose
Test file for Tokio's duplex stream functionality, specifically testing vectored write operations on in-memory bidirectional streams.

## Key Components
- **HELLO constant (L7)**: Test data payload `b"hello world..."` used across all tests
- **write_vectored test (L9-27)**: Tests vectored writing with explicit flush and drop
- **write_vectored_and_shutdown test (L29-47)**: Tests vectored writing with explicit shutdown

## Dependencies
- `tokio::io::{AsyncReadExt, AsyncWriteExt}` (L5): Core async I/O traits
- `std::io::IoSlice` (L4): For vectored I/O operations

## Test Pattern
Both tests follow identical structure:
1. Create duplex stream pair with 64-byte buffer capacity (L11, L31)
2. Write HELLO data twice using vectored I/O operations (L13-17, L33-37)  
3. Close client side (flush+drop vs shutdown+drop)
4. Read all data from server side and validate (L22-26, L42-46)

## Key Behaviors Tested
- **Vectored writes**: Using `write_vectored()` with multiple `IoSlice` instances
- **Connection termination**: Two approaches - `flush()` + `drop()` vs `shutdown()` + `drop()`
- **Data integrity**: Verifying exact byte counts and content match
- **Buffer capacity**: 64-byte duplex streams handling 28-byte payload (HELLO.len() * 2)

## Architecture Notes
- Tests are conditional on "full" feature flag (L2)
- Uses Tokio's in-memory duplex streams for deterministic testing
- Validates both write return values and actual data transmission