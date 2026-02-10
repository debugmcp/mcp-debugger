# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/examples/udp_server.rs
@source-hash: 115ecc0d9081adcb
@generated: 2026-02-09T18:11:36Z

## Primary Purpose
UDP echo server example demonstrating mio's non-blocking event-driven I/O for UDP sockets. Listens on port 9000 and echoes back any received data to the sender.

## Key Functions & Components

**main() (L11-85)** - Main server implementation with conditional compilation for non-WASI targets
- Sets up event loop with Poll instance and UDP socket
- Binds to 127.0.0.1:9000 and registers with Interest::READABLE
- Implements echo server logic using non-blocking I/O patterns

**UDP_SOCKET constant (L8)** - Token(0) identifier for socket registration in the event loop

## Dependencies & Imports
- `mio::{Events, Poll, Interest, Token, net::UdpSocket}` - Core async I/O primitives
- `log::warn` - Error logging for unexpected events
- `env_logger::init()` (L14) - Logging initialization

## Architecture & Patterns

**Event Loop Pattern (L41-84)**:
- `poll.poll()` with interrupt handling (L43-48)
- Event iteration with token matching (L51-83)
- Nested loop for packet draining (L56-75)

**Non-blocking I/O Handling**:
- `recv_from()` returns `WouldBlock` when no more packets queued (L63-67)
- Immediate echo via `send_to()` (L61)
- Buffer size set to UDP maximum (65536 bytes, L38)

**Error Handling Strategy**:
- Interrupt-tolerant polling loop (L44-46)
- `WouldBlock` used for flow control (L63-67)
- All other errors terminate the server (L69-72)

## Critical Constraints
- Single-threaded event loop design
- UDP packet size limited to 64KB buffer
- WASI platforms not supported (L87-90)
- Requires "os-poll" and "net" features for compilation

## Usage Notes
Server expects netcat-style UDP clients: `nc -u 127.0.0.1 9000`
Event capacity set to 1 since only one socket registered (L20)