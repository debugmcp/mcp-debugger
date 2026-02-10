# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tcp_connect.rs
@source-hash: a6c949cea4be2d7b
@generated: 2026-02-09T18:12:33Z

## Purpose
Test suite for Tokio's TCP connection functionality, validating various address formats and connection patterns for both IPv4 and IPv6 networks.

## Key Test Functions

### Basic Connection Tests
- `connect_v4()` (L11-36): Tests IPv4 TCP connection establishment, validates bidirectional address matching between client and server sockets using oneshot channel coordination
- `connect_v6()` (L38-63): IPv6 equivalent of v4 test, ensures proper IPv6 address binding and connection validation

### Address Format Tests
- `connect_addr_ip_string()` (L65-80): Tests connection using IP address as String format
- `connect_addr_ip_str_slice()` (L82-97): Tests connection using IP address as string slice (`&str`) 
- `connect_addr_host_string()` (L99-114): Tests connection using hostname ("localhost") as String
- `connect_addr_ip_port_tuple()` (L116-131): Tests connection using (IP, port) tuple format
- `connect_addr_ip_str_port_tuple()` (L133-148): Tests connection using ("ip_str", port) tuple
- `connect_addr_host_str_port_tuple()` (L150-165): Tests connection using ("hostname", port) tuple

## Dependencies
- `tokio::net::{TcpListener, TcpStream}` (L5): Core TCP networking types
- `tokio::sync::oneshot` (L6): Channel for coordinating async operations
- `tokio_test::assert_ok` (L7): Test assertion macro
- `futures::join` (L9): Concurrent execution utility

## Architecture Patterns
- **Test Pattern**: Each test follows server-client pattern with concurrent execution
- **Address Validation**: Tests verify symmetric address relationships (local ↔ peer)
- **Async Coordination**: Uses oneshot channels and `join!` macro for concurrent operations
- **Platform Constraints**: Conditional compilation excludes WASI and Miri environments (L2-3)

## Critical Constraints
- Requires "full" feature flag and excludes WASI/Miri targets due to socket limitations
- Uses localhost/loopback addresses only for testing
- Port 0 binding allows OS to assign available ports automatically