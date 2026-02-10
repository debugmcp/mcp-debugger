# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/net_lookup_host.rs
@source-hash: fc47597f15d7a258
@generated: 2026-02-09T18:12:21Z

**Purpose**: Integration test suite for Tokio's `net::lookup_host` functionality, validating DNS resolution and address parsing capabilities.

**Configuration**: Requires "full" feature and excludes WASI targets due to socket operation limitations (L1).

**Dependencies**:
- `tokio::net` - Core networking module providing `lookup_host` function
- `tokio_test::assert_ok` - Test utility for Result unwrapping
- `std::net` types - Socket addressing primitives (IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr)

**Test Functions**:

1. **`lookup_socket_addr` (L9-15)**: Tests direct SocketAddr lookup
   - Parses "127.0.0.1:8000" into SocketAddr
   - Verifies `lookup_host` returns identical address when given SocketAddr input
   - Validates no-op behavior for already resolved addresses

2. **`lookup_str_socket_addr` (L17-23)**: Tests string-based address lookup
   - Uses string literal "127.0.0.1:8000" as input
   - Confirms string parsing path produces same result as SocketAddr input
   - Tests ToSocketAddrs trait implementation

3. **`resolve_dns` (L25-39)**: Tests actual DNS resolution
   - Disabled under Miri due to `getaddrinfo` unavailability (L26)
   - Resolves "localhost:3000" hostname
   - Handles both IPv4 and IPv6 resolution results
   - Validates localhost resolves to 127.0.0.1:3000 or [::1]:3000
   - Returns `io::Result<()>` for proper error propagation

**Key Patterns**:
- All tests use `#[tokio::test]` for async test execution
- Uses `assert_ok!` macro for clean Result handling
- IP version agnostic testing in DNS resolution test
- Comprehensive coverage of lookup_host input types (SocketAddr, &str, hostname)