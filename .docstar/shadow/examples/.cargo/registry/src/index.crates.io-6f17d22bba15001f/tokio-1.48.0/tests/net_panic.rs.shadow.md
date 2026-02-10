# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/net_panic.rs
@source-hash: 464d3e08b75bcedf
@generated: 2026-02-09T18:12:24Z

## Purpose
Test file that verifies proper panic location reporting when tokio networking operations fail due to missing IO driver in the runtime. Ensures error messages contain accurate caller location information.

## Architecture
This file tests panic propagation for tokio networking APIs when used with a deliberately misconfigured runtime that lacks an IO driver. Each test follows the same pattern:
1. Create a standard library socket/listener
2. Attempt to convert it to tokio equivalent in a runtime without IO
3. Verify the panic location points to this test file

## Key Test Functions

### UDP Socket Tests
- `udp_socket_from_std_panic_caller()` (L14-35): Tests `UdpSocket::from_std()` panic location with standard library UDP socket

### TCP Tests  
- `tcp_listener_from_std_panic_caller()` (L37-54): Tests `TcpListener::from_std()` panic location
- `tcp_stream_from_std_panic_caller()` (L56-75): Tests `TcpStream::from_std()` panic location

### Unix Socket Tests (unix only)
- `unix_listener_bind_panic_caller()` (L77-97): Tests `UnixListener::bind()` panic location
- `unix_listener_from_std_panic_caller()` (L99-120): Tests `UnixListener::from_std()` panic location  
- `unix_stream_from_std_panic_caller()` (L122-144): Tests `UnixStream::from_std()` panic location
- `unix_datagram_from_std_panic_caller()` (L146-172): Tests `UnixDatagram::from_std()` panic location

### Windows Named Pipe Tests (windows only)
- `server_options_max_instances_panic_caller()` (L174-191): Tests `ServerOptions::max_instances()` panic location

## Utility Functions
- `runtime_without_io()` (L194-196): Creates a tokio runtime without IO driver enabled, causing network operations to panic

## Dependencies
- `support::panic::test_panic`: Utility for capturing panic location information (imported L12)
- `tokio::net`: Various networking types being tested
- `tokio::runtime`: Runtime builder for creating IO-less runtime
- `tempfile`: For creating temporary socket paths in Unix tests

## Test Pattern
All tests use consistent assertion: `assert_eq!(&panic_location_file.unwrap(), file!())` to verify panic originates from this test file, ensuring proper error attribution.

## Configuration
- Requires "full" feature and non-WASI targets (L2)
- Requires "unwind" panic strategy (L3)  
- Skips on miri due to missing socket support (various `#[cfg_attr(miri, ignore)]`)