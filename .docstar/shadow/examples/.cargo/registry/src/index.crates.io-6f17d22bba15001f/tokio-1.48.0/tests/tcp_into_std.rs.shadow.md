# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tcp_into_std.rs
@source-hash: 3633e73cfcd588e9
@generated: 2026-02-09T18:12:32Z

## Purpose
Test file validating Tokio TCP stream conversion to/from standard library TCP streams, ensuring proper interoperability between async and blocking I/O models.

## Key Components

**Main Test Function: `tcp_into_std()` (L12-46)**
- Demonstrates bidirectional conversion between `tokio::net::TcpStream` and `std::net::TcpStream`
- Tests both `into_std()` and `from_std()` methods
- Validates data transmission works correctly after conversions

## Test Flow

1. **Setup Phase (L13-16)**: Creates TCP listener on localhost with dynamic port allocation
2. **Connection Establishment (L17-22)**: Spawns async task to create client connection, accepts server-side connection
3. **Tokio → Std Conversion (L23-34)**: 
   - Converts Tokio stream to std stream using `into_std()` (L23)
   - Sets blocking mode for synchronous operations (L24-26)
   - Performs blocking read operation to verify functionality
4. **Std → Tokio Conversion (L36-44)**:
   - Re-enables non-blocking mode (L37-39)
   - Converts back to Tokio stream using `from_std()` (L40)
   - Performs async read operation to verify round-trip conversion

## Dependencies
- `tokio::net::{TcpListener, TcpStream}` - Async TCP networking
- `tokio::io::{AsyncReadExt, AsyncWriteExt}` - Async I/O traits
- `std::io::{Read, Result}` - Standard blocking I/O

## Platform Constraints
- Disabled on WASI (no socket support) and Miri (no network simulation) via cfg attributes (L2-3)
- Requires "full" feature flag for complete Tokio functionality

## Key Behaviors
- Demonstrates proper socket mode switching (blocking/non-blocking) required for std/Tokio interop
- Validates that TCP stream state and connection persist through conversions
- Uses fixed-size buffer (12 bytes) matching test message lengths