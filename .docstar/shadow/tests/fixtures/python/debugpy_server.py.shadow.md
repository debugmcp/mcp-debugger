# tests/fixtures/python/debugpy_server.py
@source-hash: e588a565cc020480
@generated: 2026-02-10T00:41:26Z

**Purpose**: Test fixture that simulates a minimal debugpy server for testing MCP Server debugpy connections. Implements a basic DAP (Debug Adapter Protocol) server that can handle standard debugging protocol messages.

**Architecture**: Simple socket-based server with synchronous connection handling. Each connection is processed sequentially in a blocking manner.

**Key Functions**:
- `signal_handler(sig, frame)` (L13-16): Graceful shutdown handler for SIGINT/SIGTERM signals
- `send_dap_response(conn, request_id, command, body=None)` (L18-32): Constructs and sends DAP-compliant responses with proper Content-Length headers and JSON payloads
- `handle_connection(conn, addr)` (L34-113): Core connection handler that:
  - Implements DAP message parsing with buffering for incomplete messages
  - Handles standard DAP commands: initialize, launch, configurationDone, threads, disconnect
  - Uses simple header parsing to extract Content-Length for message boundaries
- `main()` (L115-147): Server entry point with argument parsing, socket setup, and connection acceptance loop

**DAP Protocol Implementation**:
- Supports basic capability negotiation via initialize command (L72-87)
- Returns mock thread information (single MainThread with ID 1)
- Implements proper message framing with Content-Length headers
- Handles disconnect requests for clean session termination

**Dependencies**: Standard library only (socket, json, signal, argparse, sys, time)

**Configuration**: 
- Default port 5678 (standard debugpy port)
- Listens only on localhost (127.0.0.1)
- Supports --no-wait flag for compatibility (unused in implementation)

**Limitations**: 
- Single-threaded, handles one connection at a time
- Minimal DAP implementation - only handles basic commands
- No actual debugging capabilities - purely for protocol testing