# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/udp.rs
@source-hash: 1021625acfeab719
@generated: 2026-02-09T18:12:47Z

## Purpose
Test suite for Tokio's `UdpSocket` implementation, providing comprehensive coverage of UDP networking operations including async/poll-based I/O, message sending/receiving, peeking, and socket splitting patterns.

## Key Test Functions

### Basic Send/Receive Tests (L14-29, L31-47)
- `send_recv()`: Tests connected UDP sockets using high-level async APIs (`send`/`recv`)
- `send_recv_poll()`: Same functionality using low-level polling APIs (`poll_send`/`poll_recv`)

### Unconnected Socket Tests (L49-80) 
- `send_to_recv_from()`: Tests `send_to`/`recv_from` for unconnected sockets
- `send_to_recv_from_poll()`: Poll-based version using `poll_send_to`/`poll_recv_from`

### Message Peeking Tests (L82-261)
- `send_to_peek_from()` (L82-108): Tests `peek_from()` non-destructive message inspection
- `send_to_try_peek_from()` (L110-147): Tests `try_peek_from()` with manual readiness polling
- `send_to_peek_from_poll()` (L149-175): Poll-based peeking with `poll_peek_from()`
- `peek_sender()` (L177-200): Tests `peek_sender()` to inspect sender address without consuming message
- `poll_peek_sender()` (L202-226): Poll-based sender peeking
- `try_peek_sender()` (L228-261): Non-blocking sender peeking with readiness handling

### Socket Sharing/Splitting Tests (L263-346)
- `split()` (L263-277): Tests Arc-wrapped socket sharing between tasks
- `split_chan()` (L279-309): Complex echo server using mpsc channels for coordination
- `split_chan_poll()` (L311-346): Poll-based version of channel echo pattern

### Non-blocking I/O Tests (L356-526)
- `try_send_spawn()` (L356-395): Tests `try_send`/`try_send_to` with explicit threading
- `try_send_recv()` (L397-439): Loop-based non-blocking send/receive with readiness checking
- `try_send_to_recv_from()` (L441-482): Unconnected version of try_send/recv pattern
- `try_recv_buf()` (L484-526): Tests `try_recv_buf()` with vector buffers

### Buffer-based I/O Tests (L528-603)
- `recv_buf()` (L528-543): Tests `recv_buf()` with `Vec<u8>` buffers
- `try_recv_buf_from()` (L545-586): Non-blocking buffer receive from specific address
- `recv_buf_from()` (L588-603): Async buffer receive with sender address

### Readiness Polling Test (L605-646)
- `poll_ready()`: Tests `poll_send_ready()`/`poll_recv_ready()` for fine-grained flow control

## Key Dependencies
- `tokio::net::UdpSocket`: Primary UDP socket implementation
- `tokio::io::ReadBuf`: Low-level buffer management for poll-based I/O
- `std::future::poll_fn`: Utility for manual polling operations
- `tokio_test::assert_ok`: Test assertion helper
- `std::sync::Arc`: For socket sharing between tasks

## Architecture Patterns
1. **Dual API Testing**: Each operation tested with both high-level async and low-level poll APIs
2. **Readiness-based Flow Control**: Extensive use of `readable()`/`writable()` for non-blocking operations
3. **Error Handling**: Consistent `WouldBlock` error handling in try_* operations
4. **Message Integrity**: All tests verify both data content and sender/receiver addresses

## Test Constants
- `MSG` (L11): Standard test message "hello" 
- `MSG_LEN` (L12): Message length constant for assertions

## Platform Constraints
- Excludes WASI and Miri targets (L2-3) due to UDP/socket limitations
- Windows-specific behavior noted in `try_send_spawn()` test comments (L348-355)