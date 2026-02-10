# tests/fixtures/python/debugpy_server.py
@source-hash: e588a565cc020480
@generated: 2026-02-09T18:14:36Z

## Purpose
Mock debugpy server implementation for testing DAP (Debug Adapter Protocol) connections. Simulates a minimal debugpy server that accepts socket connections and handles basic DAP commands with proper protocol formatting.

## Key Components

### Signal Handling
- `signal_handler()` (L13-16): Graceful shutdown handler for SIGINT/SIGTERM signals

### DAP Protocol Implementation
- `send_dap_response()` (L18-32): Formats and sends DAP responses with proper HTTP-like headers (`Content-Length`) and JSON message body. Increments sequence numbers and maintains DAP response structure.
- `handle_connection()` (L34-113): Core connection handler implementing DAP message parsing:
  - Maintains receive buffer for incomplete messages
  - Parses HTTP-like headers to extract Content-Length
  - Handles message framing and JSON deserialization
  - Responds to DAP commands: `initialize`, `launch`, `configurationDone`, `threads`, `disconnect`
  - Returns capability information in initialize response (L73-87)

### Server Infrastructure
- `main()` (L115-150): Main server loop with:
  - Command-line argument parsing (port, no-wait compatibility flag)
  - Socket setup with SO_REUSEADDR
  - Single-threaded connection handling
  - Signal handler registration

## Architecture Patterns
- Blocking I/O with single-threaded connection handling (one connection at a time)
- HTTP-like message framing with JSON payloads following DAP specification
- State-machine approach to message parsing with buffer accumulation
- Graceful error handling for malformed JSON and connection errors

## Dependencies
- Standard library only: socket, json, signal, argparse
- Listens on localhost:5678 (default) for debugger connections

## Critical Constraints
- Single-threaded: only handles one connection at a time
- Simplified DAP implementation: basic command set only
- No actual debugging capabilities: pure mock/test fixture
- TCP socket bound to localhost only for security