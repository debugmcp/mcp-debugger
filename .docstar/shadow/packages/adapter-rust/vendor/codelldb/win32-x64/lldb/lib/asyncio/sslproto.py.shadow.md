# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/sslproto.py
@source-hash: c747273038c3d27d
@generated: 2026-02-09T18:12:34Z

## Primary Purpose

This file implements SSL/TLS protocol handling for asyncio, providing a secure transport wrapper around existing asyncio transports. It manages SSL handshakes, encryption/decryption, flow control, and state transitions for SSL connections.

## Core Components

### State Management Classes
- **SSLProtocolState** (L23-28): Enum defining SSL connection states (UNWRAPPED, DO_HANDSHAKE, WRAPPED, FLUSHING, SHUTDOWN)
- **AppProtocolState** (L31-44): Enum tracking application protocol lifecycle states with state transition diagram

### Transport Wrapper
- **_SSLProtocolTransport** (L82-261): Transport implementation that wraps SSLProtocol, providing the standard asyncio Transport interface
  - Delegates most operations to underlying SSLProtocol instance
  - Implements flow control methods (L146-204)
  - Handles write operations with data validation (L211-241)
  - **Key Issue**: Line 124 has hardcoded class name "_SSLProtocolTransport" in warning message instead of using dynamic type

### Main SSL Protocol
- **SSLProtocol** (L263-926): Core SSL protocol implementation extending BufferedProtocol
  - **Initialization** (L270-351): Sets up SSL context, BIO objects, buffers, and state machines
  - **Connection Lifecycle** (L382-425): Manages connection setup/teardown and handshake initiation
  - **Handshake Flow** (L533-606): Handles SSL handshake process with timeout management
  - **Shutdown Flow** (L609-667): Manages clean SSL shutdown with timeout handling
  - **Data Flow** (L675-804): Handles encrypted data transmission and reception
  - **Flow Control** (L820-912): Implements backpressure for both read and write operations

## Key Algorithms

### Buffered Reading (L746-774)
- Optimized for BufferedProtocol apps using pre-allocated buffers
- Attempts to fill entire buffer in single SSL read operation
- Schedules continuation if buffer completely filled

### Copied Reading (L775-804)
- Fallback for standard Protocol apps
- Accumulates multiple chunks to minimize data_received() calls
- Uses clever zero/one/many pattern to avoid list allocation for single chunks

### Write Buffer Management (L699-714)
- Maintains deque of pending write data
- Handles partial SSL writes by slicing remaining data
- Integrates with SSL BIO flow control

## Dependencies

- **ssl module**: Core SSL/TLS functionality (conditionally imported L8-11)
- **asyncio internals**: constants, exceptions, protocols, transports modules
- **MagicStack/uvloop**: Contains code derived from uvloop v0.16.0

## Architecture Patterns

- **State Machine**: Strict state transitions enforced by _set_state() (L493-530)
- **BIO-based SSL**: Uses memory BIO objects for non-blocking SSL operations
- **Layered Transport**: SSL transport wraps underlying transport, app sees SSL transport
- **Flow Control**: Implements multi-level backpressure (SSL socket, app protocol, underlying transport)
- **Timeout Management**: Separate timeouts for handshake and shutdown phases

## Critical Invariants

- SSL state transitions must follow defined sequence (UNWRAPPED → DO_HANDSHAKE → WRAPPED → FLUSHING → SHUTDOWN)
- App protocol state changes must be synchronized with SSL state
- Buffer limits must maintain high >= low >= 0 relationship
- Connection cleanup must handle all timeout handles and state resets

## Utility Functions

- **_create_transport_context** (L47-58): Creates default SSL context for client connections
- **add_flowcontrol_defaults** (L61-79): Calculates flow control watermarks with validation